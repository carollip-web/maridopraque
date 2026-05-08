import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const materialItemSchema = z.object({
  materialId: z.string().uuid(),
  quantidade: z.number().positive().max(1000),
});

const solicitarSchema = z.object({
  serviceId: z.string().uuid().nullable(),
  serviceName: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(2000).optional(),
  materiais: z.array(materialItemSchema).max(30).optional(),
});

export const solicitarOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => solicitarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("orcamentos")
      .insert({
        cliente_id: userId,
        service_id: data.serviceId,
        service_name: data.serviceName,
        descricao: data.descricao ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (data.materiais && data.materiais.length > 0) {
      const ids = data.materiais.map((m) => m.materialId);
      const { data: mats, error: e2 } = await supabase
        .from("materiais")
        .select("id, nome, unidade, preco_atual")
        .in("id", ids);
      if (e2) throw new Error(e2.message);

      const items = data.materiais
        .map((m) => {
          const mat = mats?.find((x) => x.id === m.materialId);
          if (!mat) return null;
          return {
            orcamento_id: row.id,
            material_id: mat.id,
            nome_snapshot: mat.nome,
            unidade_snapshot: mat.unidade,
            quantidade: m.quantidade,
            preco_unitario: Number(mat.preco_atual),
          };
        })
        .filter(Boolean) as Array<Record<string, unknown>>;

      if (items.length > 0) {
        const { error: e3 } = await supabase.from("orcamento_materiais").insert(items);
        if (e3) throw new Error(e3.message);
      }
    }

    return { orcamento: row };
  });

const enviarSchema = z.object({
  orcamentoId: z.string().uuid(),
  valorServico: z.number().positive().max(100000),
  observacoes: z.string().trim().max(2000).optional(),
});

export const enviarOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => enviarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // valida range do catálogo
    const { data: orc } = await supabase
      .from("orcamentos")
      .select("service_id")
      .eq("id", data.orcamentoId)
      .single();

    if (orc?.service_id) {
      const { data: cat } = await supabase
        .from("services_catalog")
        .select("preco_min, preco_max, nome")
        .eq("id", orc.service_id)
        .single();
      if (cat?.preco_min != null && cat?.preco_max != null) {
        if (data.valorServico < Number(cat.preco_min) || data.valorServico > Number(cat.preco_max)) {
          throw new Error(
            `Valor fora do range tabelado para "${cat.nome}" (R$ ${Number(cat.preco_min).toFixed(2)} – R$ ${Number(cat.preco_max).toFixed(2)})`,
          );
        }
      }
    }

    const { data: row, error } = await supabase
      .from("orcamentos")
      .update({
        valor_servico: data.valorServico,
        observacoes_profissional: data.observacoes ?? null,
        profissional_id: userId,
        status: "enviado",
      })
      .eq("id", data.orcamentoId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { orcamento: row };
  });

const decisaoSchema = z.object({
  orcamentoId: z.string().uuid(),
  decisao: z.enum(["aprovado", "recusado"]),
});

export const decidirOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => decisaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("orcamentos")
      .update({
        status: data.decisao,
        data_aprovacao: data.decisao === "aprovado" ? new Date().toISOString() : null,
      })
      .eq("id", data.orcamentoId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { orcamento: row };
  });
