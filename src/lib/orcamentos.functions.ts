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
        .filter((x): x is NonNullable<typeof x> => x !== null);

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

    // Instead of updating the order and claiming it, we submit a proposal
    const { data: row, error } = await (supabase as any).from("propostas")
      .insert({
        orcamento_id: data.orcamentoId,
        profissional_id: userId,
        valor_servico: data.valorServico,
        observacoes: data.observacoes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    
    // Also mark the orcamento_materiais if any existed
    
    return { proposta: row };
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

const aceitarPropostaSchema = z.object({
  orcamentoId: z.string().uuid(),
  propostaId: z.string().uuid(),
});

export const aceitarProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => aceitarPropostaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    // First verify if the orcamento belongs to the user and is still open
    const { data: orc } = await supabase.from("orcamentos").select("cliente_id, status").eq("id", data.orcamentoId).single();
    if (!orc || orc.cliente_id !== userId) throw new Error("Sem permissão");
    if (orc.status !== "customizado_pendente" && orc.status !== "enviado") throw new Error("Pedido não está mais aberto para propostas.");

    // Update the specific proposta to aceita
    const { data: prop, error: e1 } = await (supabase as any).from("propostas")
      .update({ status: 'aceita' })
      .eq("id", data.propostaId)
      .select()
      .single();
    if (e1) throw new Error(e1.message);

    // Reject other proposals
    await (supabase as any).from("propostas").update({ status: 'recusada' }).eq("orcamento_id", data.orcamentoId).neq("id", data.propostaId);

    // Update orcamento
    const { data: row, error } = await supabase
      .from("orcamentos")
      .update({
        profissional_id: prop.profissional_id,
        valor_servico: prop.valor_servico,
        observacoes_profissional: prop.observacoes,
        status: "aprovado",
        data_aprovacao: new Date().toISOString(),
      })
      .eq("id", data.orcamentoId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    
    return { orcamento: row };
  });

const editarSchema = z.object({
  orcamentoId: z.string().uuid(),
  descricao: z.string().trim().max(2000).optional(),
  materiais: z.array(materialItemSchema).max(30).optional(),
});

export const editarOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => editarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Só pode editar enquanto o profissional ainda não respondeu
    const { data: orc, error: e0 } = await supabase
      .from("orcamentos")
      .select("id, cliente_id, status")
      .eq("id", data.orcamentoId)
      .single();
    if (e0 || !orc) throw new Error("Orçamento não encontrado.");
    if (orc.cliente_id !== userId) throw new Error("Sem permissão para editar.");
    if (orc.status !== "customizado_pendente") {
      throw new Error("Este orçamento já está em análise e não pode mais ser editado.");
    }

    const { error: eu } = await supabase
      .from("orcamentos")
      .update({ descricao: data.descricao ?? null })
      .eq("id", data.orcamentoId);
    if (eu) throw new Error(eu.message);

    // Substitui materiais
    const { error: ed } = await supabase
      .from("orcamento_materiais")
      .delete()
      .eq("orcamento_id", data.orcamentoId);
    if (ed) throw new Error(ed.message);

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
            orcamento_id: data.orcamentoId,
            material_id: mat.id,
            nome_snapshot: mat.nome,
            unidade_snapshot: mat.unidade,
            quantidade: m.quantidade,
            preco_unitario: Number(mat.preco_atual),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (items.length > 0) {
        const { error: e3 } = await supabase.from("orcamento_materiais").insert(items);
        if (e3) throw new Error(e3.message);
      }
    }

    return { ok: true };
  });
