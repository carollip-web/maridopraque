import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireWritableAdminSection } from "./admin-permissions.server";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  await requireWritableAdminSection(supabase, userId, "servicos");
}

const servicoSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(160),
  categoria: z.string().trim().min(1).max(80),
  descricao: z.string().trim().max(2000).optional().nullable(),
  tipo_preco: z.enum(["fixo", "range", "sob_orcamento"]),
  preco_fixo: z.number().nonnegative().max(1000000).optional().nullable(),
  preco_min: z.number().nonnegative().max(1000000).optional().nullable(),
  preco_max: z.number().nonnegative().max(1000000).optional().nullable(),
  unidade: z.string().trim().max(40).optional().nullable(),
  comissao_marketplace_pct: z.number().min(0).max(100).optional().default(15),
  ativo: z.boolean().optional(),
});

export const salvarServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => servicoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const isFixed = data.tipo_preco === "fixo";
    const isSobOrcamento = data.tipo_preco === "sob_orcamento";

    if (isFixed && !isSobOrcamento) {
      if ((data.preco_fixo ?? 0) <= 0) throw new Error("Preço fixo deve ser maior que zero");
    }
    if (data.tipo_preco === "range") {
      if ((data.preco_max ?? 0) < (data.preco_min ?? 0))
        throw new Error("Preço máximo deve ser >= mínimo");
    }

    const payload = {
      nome: data.nome,
      categoria: data.categoria,
      descricao: data.descricao ?? null,
      is_fixed_price: isFixed,
      preco_fixo: isFixed ? (data.preco_fixo ?? null) : null,
      preco_min: data.tipo_preco === "range" ? (data.preco_min ?? null) : null,
      preco_max: data.tipo_preco === "range" ? (data.preco_max ?? null) : null,
      comissao_marketplace_pct: data.comissao_marketplace_pct ?? 15,
      ativo: data.ativo ?? true,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("services_catalog")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { servico: row };
    }
    const { data: row, error } = await supabase
      .from("services_catalog")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { servico: row };
  });

const toggleSchema = z.object({ id: z.string().uuid(), ativo: z.boolean() });
export const toggleServicoAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => toggleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("services_catalog")
      .update({ ativo: data.ativo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const vincSchema = z.object({
  service_id: z.string().uuid(),
  material_id: z.string().uuid(),
  quantidade_sugerida: z.number().positive().max(10000),
});
export const vincularMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => vincSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    // upsert manual: tenta achar existente pelo par (service_id, material_id)
    const { data: existing } = await supabase
      .from("service_materiais")
      .select("id")
      .eq("service_id", data.service_id)
      .eq("material_id", data.material_id)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await supabase
        .from("service_materiais")
        .update({ quantidade_sugerida: data.quantidade_sugerida })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, updated: true };
    }
    const { error } = await supabase.from("service_materiais").insert({
      service_id: data.service_id,
      material_id: data.material_id,
      quantidade_sugerida: data.quantidade_sugerida,
    });
    if (error) throw new Error(error.message);
    return { ok: true, updated: false };
  });

const desvincSchema = z.object({ id: z.string().uuid() });
export const desvincularMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => desvincSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("service_materiais").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteSchema = z.object({ id: z.string().uuid() });
export const deletarServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("services_catalog").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
