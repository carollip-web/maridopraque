import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireAdminLevel } from "./admin-permissions.server";
import { isProfissionalCompativelComTipoAtendimento } from "./atendimento.compat";

const materialItemSchema = z.object({
  materialId: z.string().uuid(),
  quantidade: z.number().positive().max(1000),
});

const solicitarSchema = z.object({
  serviceId: z.string().uuid().nullable(),
  serviceName: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(2000).optional(),
  materiais: z.array(materialItemSchema).max(30).optional(),
  tipoAtendimento: z.string().optional(),
  dataPreferida: z.string().optional(),
  periodoPreferido: z.string().optional(),
  horarioPreferido: z.string().optional(),
  flexibilidadeAgenda: z.string().optional(),
});

export const solicitarOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => solicitarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    console.info("[solicitarOrcamento] Creating for userId:", userId);
    const { data: row, error } = await supabase
      .from("orcamentos")
      .insert({
        cliente_id: userId,
        service_id: data.serviceId,
        service_name: data.serviceName,
        descricao: data.descricao ?? null,
        tipo_atendimento: data.tipoAtendimento ?? null,
        data_preferida: data.dataPreferida ?? null,
        periodo_preferido: data.periodoPreferido ?? null,
        horario_preferido: data.horarioPreferido ?? null,
        flexibilidade_agenda: data.flexibilidadeAgenda ?? 'flexivel',
      })
      .select()
      .single();
    if (error) {
      console.error("[solicitarOrcamento] error:", error);
      throw new Error(error.message);
    }
    console.info("[solicitarOrcamento] Created row:", row);

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
  observacoes: z.string().trim().max(2000).nullish(),
  materiais: z.array(materialItemSchema).max(30).optional(),
});

export const enviarOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => enviarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const observacoes = data.observacoes?.trim() || null;
    console.info("[enviarOrcamento] entry", { orcamentoId: data.orcamentoId, userId });

    // valida range do catálogo
    const { data: orc } = await supabase
      .from("orcamentos")
      .select("service_id, tipo_atendimento")
      .eq("id", data.orcamentoId)
      .single();

    if (orc?.service_id) {
      const { data: cat } = await supabase
        .from("services_catalog")
        .select("preco_min, preco_max, nome")
        .eq("id", orc.service_id)
        .single();
      if (cat?.preco_min != null && cat?.preco_max != null) {
        if (
          data.valorServico < Number(cat.preco_min) ||
          data.valorServico > Number(cat.preco_max)
        ) {
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

    // 1.1 Validar compatibilidade de atendimento (Gênero/Apoio)
    const { data: perfilProfissional, error: perfilError } = await (supabase as any)
      .from("profissional_perfil")
      .select("genero, oferece_apoio_feminino")
      .eq("user_id", userId)
      .maybeSingle();

    if (perfilError) {
      console.warn("[enviarOrcamento] não foi possível validar perfil operacional", perfilError);
    }

    const perfilAny = perfilProfissional as any;

    const compat = isProfissionalCompativelComTipoAtendimento({
      tipoAtendimento: (orc as any).tipo_atendimento,
      genero: perfilAny?.genero as any,
      ofereceApoioFeminino: perfilAny?.oferece_apoio_feminino,
    });

    if (!compat.compatible && compat.blockProposal) {
      throw new Error(
        compat.reason || "Este pedido exige um tipo de atendimento incompatível com seu perfil.",
      );
    }

    // Check for existing pending proposal from this professional
    const { data: existingProp } = await supabase
      .from("propostas")
      .select("id")
      .eq("orcamento_id", data.orcamentoId)
      .eq("profissional_id", userId)
      .eq("status", "pendente")
      .maybeSingle();

    let proposalId: string;
    let propRow: any;

    if (existingProp) {
      // Update existing proposal
      const { data: updated, error: uErr } = await supabase
        .from("propostas")
        .update({
          valor_servico: data.valorServico,
          observacoes: observacoes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProp.id)
        .select()
        .single();
      if (uErr) throw new Error(uErr.message);
      proposalId = updated.id;
      propRow = updated;
      
      // Delete old materials for this proposal
      await supabase.from("proposta_materiais").delete().eq("proposta_id", proposalId);
    } else {
      // Insert new proposal
      const { data: row, error } = await supabase
        .from("propostas")
        .insert({
          orcamento_id: data.orcamentoId,
          profissional_id: userId,
          valor_servico: data.valorServico,
          observacoes: observacoes,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      proposalId = row.id;
      propRow = row;
    }

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
            proposta_id: proposalId,
            material_id: mat.id,
            nome_snapshot: mat.nome,
            unidade_snapshot: mat.unidade,
            quantidade: m.quantidade,
            preco_unitario: Number(mat.preco_atual),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (items.length > 0) {
        const { error: e3 } = await supabase.from("proposta_materiais").insert(items);
        if (e3) throw new Error(e3.message);
      }
    }

    // 3. Update budget status to 'enviado' using Service Role to bypass RLS blocks
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;

    if (!SERVICE_KEY || !SUPABASE_URL) {
      console.error("[enviarOrcamento] Missing environment variables for Service Role");
      throw new Error("Configuração do servidor ausente: SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_URL");
    }

    const serviceClient = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false }
    });

    console.info("[enviarOrcamento] Updating status via Service Role", { orcamentoId: data.orcamentoId });
    const { data: updatedOrc, error: updateError } = await serviceClient
      .from("orcamentos")
      .update({ 
        status: "enviado",
        updated_at: new Date().toISOString()
      })
      .eq("id", data.orcamentoId)
      .in("status", ["customizado_pendente", "enviado"])
      .select("id, status, service_name, valor_servico")
      .single();

    if (updateError || !updatedOrc) {
      console.error("[enviarOrcamento] Status Update Error:", updateError);
      throw new Error("Pedido não encontrado ou status atual não permite receber proposta.");
    }

    console.info("[enviarOrcamento] Success", { orcamentoId: data.orcamentoId, status: updatedOrc.status });

    return { proposta: propRow, orcamento: updatedOrc };
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

    if (data.decisao === "aprovado") {
      const { data: fullOrc } = await supabase
        .from("orcamentos")
        .select("profissional_id, valor_servico")
        .eq("id", data.orcamentoId)
        .single();
      
      if (!fullOrc?.profissional_id || !fullOrc?.valor_servico) {
        throw new Error("Não é possível aprovar este orçamento diretamente sem um profissional ou valor definido. Utilize o fluxo de aceitar propostas.");
      }
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
    const { userId } = context;

    console.info("[aceitarProposta] start", { propostaId: data.propostaId, orcamentoId: data.orcamentoId, userId });

    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;

    if (!SERVICE_KEY || !SUPABASE_URL) {
      console.error("[aceitarProposta] Missing environment variables for Service Role");
      throw new Error("Configuração do servidor ausente: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
    }

    const serviceClient = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false }
    });

    // 1. Fetch proposal with service client
    const { data: prop, error: e_prop } = await serviceClient
      .from("propostas")
      .select("id, orcamento_id, profissional_id, valor_servico, observacoes, status")
      .eq("id", data.propostaId)
      .single();

    if (e_prop || !prop) {
      console.warn("[aceitarProposta] Proposta não encontrada", { e_prop, propostaId: data.propostaId });
      throw new Error("Proposta não encontrada.");
    }

    if (prop.orcamento_id !== data.orcamentoId) {
      throw new Error("Essa proposta não pertence a este pedido.");
    }

    if (prop.status !== "pendente") {
      throw new Error("Essa proposta não está mais disponível.");
    }

    console.info("[aceitarProposta] proposta validada", { propostaId: prop.id, orcamentoId: prop.orcamento_id });

    // 2. Fetch budget with service client (ONLY id, cliente_id, status)
    const { data: orc, error: e_orc } = await serviceClient
      .from("orcamentos")
      .select("id, cliente_id, status")
      .eq("id", data.orcamentoId)
      .single();

    if (e_orc || !orc) {
      console.warn("[aceitarProposta] Orcamento não encontrado", { e_orc, orcamentoId: data.orcamentoId });
      throw new Error("Pedido não encontrado.");
    }

    // 3. Ownership validation
    if (orc.cliente_id !== userId) {
      console.warn("[aceitarProposta] Sem permissão: cliente_id mismatch", { userId, orcClienteId: orc.cliente_id });
      throw new Error("Você não tem permissão para aprovar esta proposta.");
    }

    if (orc.status !== "customizado_pendente" && orc.status !== "enviado") {
      console.warn("[aceitarProposta] Pedido com status invalido", { status: orc.status });
      throw new Error("Pedido não está mais aberto para propostas.");
    }

    console.info("[aceitarProposta] orcamento validado", { orcamentoId: orc.id, status: orc.status });

    // 4. Update the specific proposta to aceita
    const { data: propUpdated, error: e_up } = await serviceClient
      .from("propostas")
      .update({ 
        status: "aceita",
        updated_at: new Date().toISOString()
      })
      .eq("id", data.propostaId)
      .select()
      .single();

    if (e_up) {
      console.error("[aceitarProposta] error updating proposal", e_up);
      throw new Error("Erro ao atualizar proposta.");
    }

    // 5. Reject other proposals
    await serviceClient
      .from("propostas")
      .update({ status: "recusada" })
      .eq("orcamento_id", data.orcamentoId)
      .neq("id", data.propostaId);

    // 6. Copy materials
    try {
      const { data: pMats } = await serviceClient
        .from("proposta_materiais")
        .select("*")
        .eq("proposta_id", prop.id);
      
      if (pMats && pMats.length > 0) {
        await serviceClient.from("orcamento_materiais").delete().eq("orcamento_id", data.orcamentoId);
        await serviceClient.from("orcamento_materiais").insert(
          pMats.map((m) => ({
            orcamento_id: data.orcamentoId,
            material_id: m.material_id,
            nome_snapshot: m.nome_snapshot,
            unidade_snapshot: m.unidade_snapshot,
            quantidade: m.quantidade,
            preco_unitario: m.preco_unitario,
          })),
        );
      }
    } catch (e_mats) {
      console.error("[aceitarProposta] erro ao copiar materiais (não fatal)", e_mats);
    }

    // 7. Update orcamento
    const updatePayload: any = {
      profissional_id: prop.profissional_id,
      valor_servico: prop.valor_servico,
      valor: prop.valor_servico, // Mantendo valor para exibição se o projeto usa
      observacoes_profissional: prop.observacoes,
      status: "aprovado",
      data_aprovacao: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: updatedOrc, error: e_orc_up } = await serviceClient
      .from("orcamentos")
      .update(updatePayload)
      .eq("id", data.orcamentoId)
      .select("*, propostas!propostas_orcamento_id_fkey(*)")
      .single();

    if (e_orc_up) {
      console.error("[aceitarProposta] error updating orcamento", e_orc_up);
      throw new Error("Erro ao atualizar pedido.");
    }

    // 8. Implementar reserva temporária de agenda
    let agendaReserva = "none";
    if (updatedOrc.data_preferida) {
      try {
        const baseDate = updatedOrc.data_preferida;
        let inicioStr = "";
        let fimStr = "";

        if (updatedOrc.periodo_preferido === "manha") {
          inicioStr = `${baseDate}T08:00:00Z`;
          fimStr = `${baseDate}T12:00:00Z`;
        } else if (updatedOrc.periodo_preferido === "tarde") {
          inicioStr = `${baseDate}T13:00:00Z`;
          fimStr = `${baseDate}T18:00:00Z`;
        } else if (updatedOrc.periodo_preferido === "noite") {
          inicioStr = `${baseDate}T18:00:00Z`;
          fimStr = `${baseDate}T21:00:00Z`;
        } else if (updatedOrc.periodo_preferido === "horario_especifico" && updatedOrc.horario_preferido) {
          const h = updatedOrc.horario_preferido.length === 5 ? `${updatedOrc.horario_preferido}:00` : updatedOrc.horario_preferido;
          inicioStr = `${baseDate}T${h}Z`;
          const d = new Date(inicioStr);
          d.setHours(d.getHours() + 2);
          fimStr = d.toISOString();
        }

        if (inicioStr && fimStr) {
          const inicio = new Date(inicioStr).toISOString();
          const fim = new Date(fimStr).toISOString();

          // Verificar conflitos
          const { data: conflitos } = await serviceClient
            .from("profissional_bloqueios_agenda")
            .select("id")
            .eq("profissional_id", prop.profissional_id)
            .in("status", ["temporario", "confirmado"])
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
            .filter("inicio", "lt", fim)
            .filter("fim", "gt", inicio);

          if (conflitos && conflitos.length > 0) {
            console.warn("[aceitarProposta] conflito ao reservar agenda", { orcamentoId: updatedOrc.id, conflitos });
            agendaReserva = "conflito";
          } else {
            const { error: e_block } = await serviceClient
              .from("profissional_bloqueios_agenda")
              .insert({
                profissional_id: prop.profissional_id,
                orcamento_id: updatedOrc.id,
                inicio,
                fim,
                status: "temporario",
                motivo: "Reserva temporária aguardando pagamento",
                expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2h
              });
            
            if (e_block) {
              console.error("[aceitarProposta] erro ao criar bloqueio", e_block);
            } else {
              agendaReserva = "sucesso";
            }
          }
        }
      } catch (e_agenda) {
        console.error("[aceitarProposta] erro inesperado ao processar agenda", e_agenda);
      }
    }

    console.info("[aceitarProposta] sucesso", { orcamentoId: updatedOrc.id, status: updatedOrc.status, agendaReserva });

    return { 
      orcamento: updatedOrc, 
      proposta: propUpdated,
      agendaReserva
    };
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
    const { userId } = context;

    try {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!SUPABASE_URL || !SERVICE_ROLE) {
        console.error(
          "[cancelarPedido] Erro: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no servidor.",
        );
        return { ok: false, error: "Erro de configuração do servidor. Contate o administrador." };
      }

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

      // 2. Fetch order data with admin client to verify ownership
      const { data: orc, error: e0 } = await admin
        .from("orcamentos")
        .select("cliente_id, status")
        .eq("id", data.orcamentoId)
        .single();

      if (e0 || !orc) {
        console.error("[cancelarPedido] Erro ao localizar pedido:", e0);
        return { ok: false, error: "Pedido não encontrado." };
      }

      if (orc.cliente_id !== userId) {
        return { ok: false, error: "Você não tem permissão para cancelar este pedido." };
      }

      if (["pago", "concluido"].includes(orc.status?.toLowerCase())) {
        return { ok: false, error: "Pedidos já pagos ou concluídos não podem ser removidos." };
      }

      console.info(`[cancelarPedido] Iniciando faxina para o pedido ${data.orcamentoId}...`);

      // 3. Sequential deletion with explicit error tracking
      const simpleTables = [
        { name: "Mensagens", table: "mensagens" },
        { name: "Notificações", table: "notificacoes" },
        { name: "Materiais", table: "orcamento_materiais" },
        { name: "Avaliações", table: "avaliacoes" },
        { name: "Recusas", table: "orcamento_recusas" },
        { name: "Eventos de Pânico", table: "panico_eventos" },
      ];

      for (const t of simpleTables) {
        const { error } = await admin.from(t.table).delete().eq("orcamento_id", data.orcamentoId);
        if (error) {
          console.warn(`[cancelarPedido] Aviso: Falha ao limpar ${t.name}:`, error.message);
          // We don't throw here to try to delete as much as possible,
          // but the final delete will fail if there's a hard FK.
        } else {
          console.info(`[cancelarPedido] Tabela ${t.name} limpa.`);
        }
      }

      // 4. Handle Proposals (Complex Cleanup)
      const { data: props } = await admin
        .from("propostas")
        .select("id")
        .eq("orcamento_id", data.orcamentoId);
      if (props && props.length > 0) {
        const propIds = props.map((p: { id: string }) => p.id);
        await admin.from("proposta_materiais").delete().in("proposta_id", propIds);
        await admin.from("propostas").delete().in("id", propIds);
        console.info(`[cancelarPedido] Propostas (${props.length}) limpas.`);
      }

      // 5. Final attempt to delete the main record
      const { error: ed } = await admin.from("orcamentos").delete().eq("id", data.orcamentoId);

      if (ed) {
        console.error("[cancelarPedido] ERRO CRÍTICO NA EXCLUSÃO FINAL:", ed);
        return {
          ok: false,
          error: `Não foi possível remover o pedido: ${ed.message}. Algum dado ainda está vinculado.`,
        };
      }

      console.info(`[cancelarPedido] Sucesso: Pedido ${data.orcamentoId} totalmente removido.`);
      return { ok: true };
    } catch (err: unknown) {
      console.error("[cancelarPedido] Falha catastrófica:", err);
      const message = err instanceof Error ? err.message : "Erro inesperado ao cancelar o pedido.";
      return { ok: false, error: message };
    }
  });

export const excluirPedidoAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cancelarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    try {
      // Bloqueia suporte/financeiro: exclusão de pedido só para super_admin/admin.
      await requireAdminLevel(supabase, userId, ["super_admin", "admin"]);

      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!SUPABASE_URL || !SERVICE_ROLE) {
        return {
          ok: false,
          error:
            "Configuração do servidor ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.",
        };
      }
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

      console.info(`[excluirPedidoAdmin] Admin ${userId} limpando pedido ${data.orcamentoId}...`);

      // Reuse deep cleanup logic
      const tables = [
        "avaliacoes",
        "orcamento_recusas",
        "panico_eventos",
        "mensagens",
        "notificacoes",
        "orcamento_materiais",
      ];
      for (const table of tables) {
        await admin.from(table).delete().eq("orcamento_id", data.orcamentoId);
      }

      const { data: props } = await admin
        .from("propostas")
        .select("id")
        .eq("orcamento_id", data.orcamentoId);
      if (props && props.length > 0) {
        const propIds = props.map((p: { id: string }) => p.id);
        await admin.from("proposta_materiais").delete().in("proposta_id", propIds);
        await admin.from("propostas").delete().in("id", propIds);
      }

      const { error: ed } = await admin.from("orcamentos").delete().eq("id", data.orcamentoId);
      if (ed) throw new Error(ed.message);

      return { ok: true };
    } catch (err: unknown) {
      console.error("[excluirPedidoAdmin] Erro:", err);
      const message = err instanceof Error ? err.message : "Erro ao excluir";
      return { ok: false, error: message };
    }
  });

export const criarCenarioTestePagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Verificar se usuário é admin
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    // 2. Buscar um profissional de teste
    const { data: proRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "profissional")
      .limit(1)
      .single();

    if (!proRole) throw new Error("Nenhum profissional encontrado para teste.");

    const proId = proRole.user_id;

    // 3. Criar orçamento aprovado
    const { data: orc, error } = await supabase
      .from("orcamentos")
      .insert({
        cliente_id: userId,
        profissional_id: proId,
        service_name: "🔧 Teste de Pagamento Real",
        descricao: "⚠️ Pedido gerado automaticamente para validar o checkout Mercado Pago.",
        status: "aprovado",
        valor_servico: 100.00,
        valor: 100.00,
        data_aprovacao: new Date().toISOString(),
        is_test: true
      })
      .select()
      .single();

    if (error) throw error;

    return { ok: true, orcamentoId: orc.id };
  });
