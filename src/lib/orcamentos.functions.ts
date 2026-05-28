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
        flexibilidade_agenda: data.flexibilidadeAgenda ?? "flexivel",
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

    // 0. Buscar orçamento com fallback para schema cache
    let orc: any = null;
    const { data: orcCompleto, error: orcError } = await (supabase as any)
      .from("orcamentos")
      .select("id, status, cliente_id, service_id, service_name, tipo_atendimento")
      .eq("id", data.orcamentoId)
      .maybeSingle();

    if (orcError || !orcCompleto) {
      console.warn(
        "[enviarOrcamento] falha ao buscar orçamento completo ou não encontrado",
        orcError,
      );

      // Fallback sem campos novos
      const { data: orcBasico, error: orcBasicoError } = await supabase
        .from("orcamentos")
        .select("id, status, cliente_id, service_id, service_name")
        .eq("id", data.orcamentoId)
        .maybeSingle();

      if (orcBasico && typeof orcBasico === "object" && !Array.isArray(orcBasico)) {
        const ob = orcBasico as any;
        orc = {
          id: ob.id,
          status: ob.status,
          cliente_id: ob.cliente_id,
          service_id: ob.service_id ?? null,
          service_name: ob.service_name ?? null,
          tipo_atendimento: null,
        };
      } else {
        orc = null;
      }
    } else {
      orc = orcCompleto;
    }

    // 1. Log orcamento carregado
    console.info("[enviarOrcamento] orçamento carregado", {
      orcamentoId: data.orcamentoId,
      status: orc?.status,
      serviceId: orc?.service_id,
      userId,
    });

    if (!orc) {
      throw new Error("Pedido não encontrado.");
    }

    // 2. Definir lista centralizada de status que aceitam proposta
    const STATUS_QUE_ACEITAM_PROPOSTA: Database["public"]["Enums"]["orcamento_status"][] = [
      "customizado_pendente",
      "fixo_auto",
      "enviado",
    ];

    // 3. Validar status do orçamento
    if (!STATUS_QUE_ACEITAM_PROPOSTA.includes(orc.status)) {
      console.warn("[enviarOrcamento] status não permite proposta", {
        orcamentoId: orc.id,
        statusAtual: orc.status,
        permitidos: STATUS_QUE_ACEITAM_PROPOSTA,
      });

      throw new Error(
        `Pedido com status "${orc.status}" não permite receber proposta.`
      );
    }

    // 0.1 Valida range do catálogo
    if (orc.service_id) {
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

    // 1.1 Validar compatibilidade de atendimento (Gênero/Apoio) com fallback
    let perfilProfissional: any = null;
    const { data: perfCompleto, error: perfilError } = await (supabase as any)
      .from("profissional_perfil")
      .select("genero, oferece_apoio_feminino, mp_user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (perfilError) {
      console.warn(
        "[enviarOrcamento] perfil operacional indisponível (schema cache?), tentando básico",
        perfilError,
      );

      const { data: perfBasico } = await supabase
        .from("profissional_perfil")
        .select("id, mp_user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (perfBasico && typeof perfBasico === "object" && !Array.isArray(perfBasico)) {
        const pb = perfBasico as any;
        perfilProfissional = {
          id: pb.id,
          genero: null,
          oferece_apoio_feminino: false,
          mp_user_id: pb.mp_user_id ?? null,
        };
      } else {
        perfilProfissional = null;
      }
    } else {
      perfilProfissional = perfCompleto;
    }

    const compat = isProfissionalCompativelComTipoAtendimento({
      tipoAtendimento: orc.tipo_atendimento ?? null,
      genero: perfilProfissional?.genero as any,
      ofereceApoioFeminino: perfilProfissional?.oferece_apoio_feminino ?? false,
    });

    console.info("[enviarOrcamento] validação compatibilidade", {
      orcamentoId: orc.id,
      tipo: orc.tipo_atendimento,
      compat,
    });

    if (!compat.compatible && compat.blockProposal) {
      throw new Error(
        compat.reason || "Este pedido exige um tipo de atendimento incompatível com seu perfil.",
      );
    }

    // Bloquear envio se profissional não conectou Mercado Pago (necessário pro split)
    if (!perfilProfissional?.mp_user_id) {
      console.warn("[enviarOrcamento] bloqueado: profissional sem Mercado Pago conectado", { userId });
      throw new Error(
        "Você precisa conectar sua conta Mercado Pago antes de enviar orçamentos. " +
        "Acesse Configurações de Perfil > Mercado Pago para conectar."
      );
    }

    // 3. Update budget status to 'enviado' using RPC
    console.info("[enviarOrcamento] chamando RPC marcar_orcamento_enviado", {
      orcamentoId: data.orcamentoId,
      statusAtual: orc.status,
    });

    const { data: updatedRows, error: updateError } = await (supabase as any)
      .rpc("marcar_orcamento_enviado", {
        _orcamento_id: data.orcamentoId,
      });

    if (updateError) {
      console.error("[enviarOrcamento] erro na RPC marcar_orcamento_enviado", {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        orcamentoId: data.orcamentoId,
        statusAtual: orc.status,
      });

      throw new Error(
        `Não foi possível marcar o pedido como enviado. Status atual: ${orc.status}. ${updateError.message}`
      );
    }

    const updatedOrc = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;

    if (!updatedOrc) {
      throw new Error("Pedido não encontrado ou status atual não permite receber proposta.");
    }

    // Check for existing pending/accepted proposal from this professional
    const { data: existingProp } = await supabase
      .from("propostas")
      .select("id")
      .eq("orcamento_id", data.orcamentoId)
      .eq("profissional_id", userId)
      .in("status", ["pendente", "aceita"])
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

    console.info("[enviarOrcamento] Success", {
      orcamentoId: data.orcamentoId,
      status: updatedOrc.status,
    });

    // 4. Create Notification for the client
    if (orc.cliente_id) {
      const { error: notifError } = await supabase.from("notificacoes").insert({
        user_id: orc.cliente_id,
        titulo: "Nova Proposta Recebida",
        mensagem: `Um profissional enviou uma proposta para o pedido "${orc.service_name || "Serviço"}".`,
        orcamento_id: data.orcamentoId,
        link: `/cliente?tab=pedidos&pedidoId=${data.orcamentoId}`,
        lida: false,
      });

      if (notifError) {
        console.warn("[enviarOrcamento] notificação não criada", {
          code: notifError.code,
          message: notifError.message,
          details: notifError.details,
          hint: notifError.hint,
        });
      }
    }

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
        throw new Error(
          "Não é possível aprovar este orçamento diretamente sem um profissional ou valor definido. Utilize o fluxo de aceitar propostas.",
        );
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
  propostaId: z.string().uuid(),
  orcamentoId: z.string().uuid().optional(),
});

export const aceitarProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => aceitarPropostaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    console.info("[aceitarProposta] start", {
      propostaId: data.propostaId,
      orcamentoIdRecebido: data.orcamentoId,
      userId,
    });

    const { data: resultRows, error } = await (supabase as any)
      .rpc("aceitar_proposta_cliente", {
        _proposta_id: data.propostaId,
      });

    if (error) {
      console.error("[aceitarProposta] erro na RPC aceitar_proposta_cliente", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        propostaId: data.propostaId,
        orcamentoIdRecebido: data.orcamentoId,
      });

      throw new Error(error.message || "Erro ao aprovar proposta.");
    }

    const result = Array.isArray(resultRows) ? resultRows[0] : resultRows;

    if (!result?.ok) {
      throw new Error("Não foi possível aprovar a proposta.");
    }

    return {
      ok: true,
      orcamentoId: result.orcamento_id,
      propostaId: result.proposta_id,
      agendaReserva: result.agenda_reserva,
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
        valor_servico: 100.0,
        valor: 100.0,
        data_aprovacao: new Date().toISOString(),
        is_test: true,
      })
      .select()
      .single();

    if (error) throw error;

    return { ok: true, orcamentoId: orc.id };
  });
