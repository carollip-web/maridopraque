import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

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
    console.log("[solicitarOrcamento] Creating for userId:", userId);
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
    if (error) {
      console.error("[solicitarOrcamento] error:", error);
      throw new Error(error.message);
    }
    console.log("[solicitarOrcamento] Created row:", row);

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
  materiais: z.array(materialItemSchema).max(30).optional(),
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

    // 1. Check if the user is a professional
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "profissional")
      .maybeSingle();

    if (!roleData) {
      throw new Error("Apenas profissionais podem enviar orçamentos.");
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
    
    // Process proposal materials if provided
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
            proposta_id: row.id,
            material_id: mat.id,
            nome_snapshot: mat.nome,
            unidade_snapshot: mat.unidade,
            quantidade: m.quantidade,
            preco_unitario: Number(mat.preco_atual),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (items.length > 0) {
        const { error: e3 } = await (supabase as any).from("proposta_materiais").insert(items);
        if (e3) throw new Error(e3.message);
      }
    }
    
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
    const { supabase, userId } = context;

    // Check if the budget belongs to the user
    const { data: orcCheck } = await supabase
      .from("orcamentos")
      .select("cliente_id")
      .eq("id", data.orcamentoId)
      .single();

    if (!orcCheck || orcCheck.cliente_id !== userId) {
      throw new Error("Sem permissão para decidir sobre este orçamento.");
    }

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

    // Update the specific proposta to aceita, ensuring it belongs to the correct budget
    const { data: prop, error: e1 } = await (supabase as any).from("propostas")
      .update({ status: 'aceita' })
      .eq("id", data.propostaId)
      .eq("orcamento_id", data.orcamentoId)
      .select()
      .single();
    if (e1) throw new Error("Proposta inválida ou não pertence a este orçamento.");

    // Reject other proposals
    console.log(`Cliente ${userId} aceitou proposta ${data.propostaId} para o pedido ${data.orcamentoId}`);
    await (supabase as any).from("propostas").update({ status: 'recusada' }).eq("orcamento_id", data.orcamentoId).neq("id", data.propostaId);

    // Copy materials from proposta_materiais to orcamento_materiais
    const { data: pMats } = await (supabase as any).from("proposta_materiais").select("*").eq("proposta_id", prop.id);
    if (pMats && pMats.length > 0) {
      // First clear existing orcamento_materiais if any
      await supabase.from("orcamento_materiais").delete().eq("orcamento_id", data.orcamentoId);
      // Insert new ones
      await supabase.from("orcamento_materiais").insert(
        pMats.map((m: any) => ({
          orcamento_id: data.orcamentoId,
          material_id: m.material_id,
          nome_snapshot: m.nome_snapshot,
          unidade_snapshot: m.unidade_snapshot,
          quantidade: m.quantidade,
          preco_unitario: m.preco_unitario,
        }))
      );
    }

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

const cancelarSchema = z.object({
  orcamentoId: z.string().uuid(),
});

export const cancelarPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cancelarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase: userClient, userId } = context;

    try {
      // 1. Create an admin client to bypass RLS
      const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!SERVICE_ROLE) {
        console.warn("[cancelarPedido] WARNING: SUPABASE_SERVICE_ROLE_KEY not found. Deletion might fail due to RLS.");
      }

      const admin = SERVICE_ROLE ? createClient(SUPABASE_URL!, SERVICE_ROLE) : userClient;

      // 2. Verify ownership
      const { data: orc, error: e0 } = await admin
        .from("orcamentos")
        .select("cliente_id, status")
        .eq("id", data.orcamentoId)
        .single();
      
      if (e0 || !orc) {
        console.error("[cancelarPedido] Pedido não encontrado:", data.orcamentoId, e0);
        return { ok: false, error: "Pedido não encontrado." };
      }

      if (orc.cliente_id !== userId) {
        console.warn(`[cancelarPedido] Tentativa de exclusão não autorizada por usuário ${userId} para pedido ${data.orcamentoId}`);
        return { ok: false, error: "Sem permissão para cancelar este pedido." };
      }
      
      if (["pago", "concluido"].includes(orc.status?.toLowerCase())) {
        return { ok: false, error: "Este pedido já foi pago ou concluído e não pode ser cancelado." };
      }

      console.log(`[cancelarPedido] Iniciando limpeza profunda para o pedido ${data.orcamentoId}...`);

      // 3. Delete linked data in the correct order to avoid FK errors
      const cleanupTasks = [
        { table: "avaliacoes", field: "orcamento_id" },
        { table: "orcamento_recusas", field: "orcamento_id" },
        { table: "panico_eventos", field: "orcamento_id" },
        { table: "mensagens", field: "orcamento_id" },
        { table: "notificacoes", field: "orcamento_id" },
        { table: "orcamento_materiais", field: "orcamento_id" },
      ];

      for (const task of cleanupTasks) {
        const { error } = await admin.from(task.table).delete().eq(task.field, data.orcamentoId);
        if (error) {
          console.warn(`[cancelarPedido] Falha ao limpar tabela ${task.table}:`, error.message);
        } else {
          console.log(`[cancelarPedido] Tabela ${task.table} limpa.`);
        }
      }
      
      // Propostas depend on Proposal Materials
      const { data: props } = await admin.from("propostas").select("id").eq("orcamento_id", data.orcamentoId);
      if (props && props.length > 0) {
        const propIds = props.map((p: any) => p.id);
        const { error: em } = await admin.from("proposta_materiais").delete().in("proposta_id", propIds);
        if (em) console.warn("[cancelarPedido] Falha ao limpar proposta_materiais:", em.message);
        
        const { error: ep } = await admin.from("propostas").delete().in("id", propIds);
        if (ep) console.warn("[cancelarPedido] Falha ao limpar propostas:", ep.message);
        
        console.log(`[cancelarPedido] Propostas (${props.length}) limpas.`);
      }

      // 4. Finally, delete the budget itself
      const { error: ed } = await admin.from("orcamentos").delete().eq("id", data.orcamentoId);
      if (ed) {
        console.error("[cancelarPedido] ERRO FINAL AO EXCLUIR ORCAMENTO:", ed.message);
        throw new Error(`Não foi possível remover o registro principal: ${ed.message}`);
      }

      console.log(`[cancelarPedido] Pedido ${data.orcamentoId} removido com sucesso.`);
      return { ok: true };
    } catch (err: any) {
      console.error("[cancelarPedido] Erro fatal durante o processo:", err);
      return { ok: false, error: err.message || "Erro interno ao processar o cancelamento." };
    }
  });

export const excluirPedidoAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cancelarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase: userClient, userId } = context;

    try {
      // 1. Create admin client
      const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const admin = SERVICE_ROLE ? createClient(SUPABASE_URL!, SERVICE_ROLE) : userClient;

      // 2. Verify if caller is admin
      const { data: roleData } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) throw new Error("Apenas administradores podem excluir pedidos.");

      console.log(`[excluirPedidoAdmin] Admin ${userId} iniciando exclusão do pedido ${data.orcamentoId}...`);

      // 3. Re-use the cleanup logic logic for robustness
      const cleanupTables = ["avaliacoes", "orcamento_recusas", "panico_eventos", "mensagens", "notificacoes", "orcamento_materiais"];
      for (const table of cleanupTables) {
        await admin.from(table).delete().eq("orcamento_id", data.orcamentoId);
      }
      
      const { data: props } = await admin.from("propostas").select("id").eq("orcamento_id", data.orcamentoId);
      if (props && props.length > 0) {
        const propIds = props.map((p: any) => p.id);
        await admin.from("proposta_materiais").delete().in("proposta_id", propIds);
        await admin.from("propostas").delete().in("id", propIds);
      }

      const { error: ed } = await admin.from("orcamentos").delete().eq("id", data.orcamentoId);
      if (ed) throw new Error(ed.message);

      return { ok: true };
    } catch (err: any) {
      console.error("[excluirPedidoAdmin] Erro:", err);
      return { ok: false, error: err.message || "Erro ao excluir pedido" };
    }
  });
