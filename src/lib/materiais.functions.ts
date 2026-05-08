import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchMarketplacePrice } from "./materiais.server";

const atualizarSchema = z.object({ materialId: z.string().uuid() });

export const atualizarPrecoMaterialMarketplace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => atualizarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // valida admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!roles?.some((r) => r.role === "admin")) {
      throw new Error("Apenas admin pode atualizar preço de marketplace");
    }

    const { data: mat, error: e1 } = await supabase
      .from("materiais")
      .select("*")
      .eq("id", data.materialId)
      .single();
    if (e1 || !mat) throw new Error(e1?.message ?? "Material não encontrado");

    const quote = await fetchMarketplacePrice(mat.nome, Number(mat.preco_base), mat.marketplace_url);

    const { data: updated, error: e2 } = await supabase
      .from("materiais")
      .update({
        preco_atual: quote.preco,
        preco_fonte: quote.fonte,
        preco_atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.materialId)
      .select()
      .single();
    if (e2) throw new Error(e2.message);

    return { material: updated };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(120),
  unidade: z.string().trim().min(1).max(20),
  preco_base: z.number().nonnegative().max(100000),
  marketplace_url: z.string().trim().url().max(500).optional().nullable(),
  ativo: z.boolean().optional(),
});

export const salvarMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    if (!roles?.some((r) => r.role === "admin")) throw new Error("Apenas admin");

    if (data.id) {
      const { data: row, error } = await supabase
        .from("materiais")
        .update({
          nome: data.nome,
          unidade: data.unidade,
          preco_base: data.preco_base,
          marketplace_url: data.marketplace_url ?? null,
          ativo: data.ativo ?? true,
        })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { material: row };
    } else {
      const { data: row, error } = await supabase
        .from("materiais")
        .insert({
          nome: data.nome,
          unidade: data.unidade,
          preco_base: data.preco_base,
          preco_atual: data.preco_base,
          preco_fonte: "tabela",
          marketplace_url: data.marketplace_url ?? null,
          ativo: data.ativo ?? true,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { material: row };
    }
  });
