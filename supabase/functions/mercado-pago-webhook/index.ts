// redeploy: 2026-05-29
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const MP_WEBHOOK_SECRET = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");

async function verificarAssinaturaMP(req: Request, requestId: string): Promise<boolean> {
  if (!MP_WEBHOOK_SECRET) {
    console.error(`[Webhook ${requestId}] MERCADO_PAGO_WEBHOOK_SECRET não configurada — rejeitando requisição. Configure o secret no painel MP Developers e nas Edge Function Secrets para liberar o webhook.`);
    return false;
  }
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  const { searchParams } = new URL(req.url);
  const dataId = searchParams.get("data.id") || searchParams.get("id");
  if (!xSignature || !xRequestId || !dataId) return false;

  const ts = xSignature.match(/ts=([^,]+)/)?.[1];
  const v1 = xSignature.match(/v1=([^,]+)/)?.[1];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(MP_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed === v1;
}

function calcularIntervaloReserva(
  dataPreferida: string | Date,
  periodo?: string | null,
  horario?: string | null,
) {
  const data = String(dataPreferida).slice(0, 10);

  if (periodo === "manha") {
    return { inicio: `${data}T08:00:00-03:00`, fim: `${data}T12:00:00-03:00` };
  }

  if (periodo === "tarde") {
    return { inicio: `${data}T13:00:00-03:00`, fim: `${data}T18:00:00-03:00` };
  }

  if (periodo === "noite") {
    return { inicio: `${data}T18:00:00-03:00`, fim: `${data}T21:00:00-03:00` };
  }

  if (periodo === "horario_especifico" && horario) {
    const hora = String(horario).slice(0, 5);
    const inicioDate = new Date(`${data}T${hora}:00-03:00`);
    const fimDate = new Date(inicioDate.getTime() + 2 * 60 * 60 * 1000);

    return { inicio: inicioDate.toISOString(), fim: fimDate.toISOString() };
  }

  return { inicio: `${data}T08:00:00-03:00`, fim: `${data}T12:00:00-03:00` };
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[Webhook ${requestId}] Request received`);

  try {
    const assinaturaValida = await verificarAssinaturaMP(req, requestId);
    if (!assinaturaValida) {
      const sp = new URL(req.url).searchParams;
      const topic = sp.get("topic") || sp.get("type");
      const dataId = sp.get("data.id") || sp.get("id");
      console.warn(
        `[Webhook ${requestId}] Assinatura inválida — requisição rejeitada. ` +
          `Topic/Type: ${topic || "n/a"}, Data ID: ${dataId || "n/a"}, ` +
          `x-signature presente: ${req.headers.has("x-signature")}, x-request-id presente: ${req.headers.has("x-request-id")}`,
      );
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Mercado Pago envia o ID do recurso via query param
    const { searchParams } = new URL(req.url);

    // Suporta tanto formato antigo (topic/id) quanto novo (type/data.id)
    const topic = searchParams.get("topic") || searchParams.get("type");
    const resourceId = searchParams.get("id") || searchParams.get("data.id");

    if (topic !== "payment") {
      console.log(`[Webhook ${requestId}] Ignorando tópico irrelevante: ${topic}`);
      return new Response(JSON.stringify({ message: "Topic ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!resourceId) {
      console.error(`[Webhook ${requestId}] ID do recurso ausente`);
      return new Response(JSON.stringify({ error: "Missing resource ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!MP_ACCESS_TOKEN) {
      throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado na Edge Function.");
    }

    // Inicializar cliente Supabase com Service Role para bypass RLS (antes do MP p/ fallback)
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // 1. Consultar o Mercado Pago para validar o pagamento (Segurança: não confiar apenas no body)
    console.log(`[Webhook ${requestId}] Consultando pagamento ${resourceId} no Mercado Pago (token marketplace)...`);
    let mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
    });

    // Fallback: split usa token do seller (profissional); tente buscar token dele via orcamentoId no query param
    if (!mpRes.ok && (mpRes.status === 401 || mpRes.status === 404)) {
      console.warn(`[Webhook ${requestId}] MP retornou ${mpRes.status} com token marketplace. Tentando fallback com token do profissional...`);
      const orcamentoIdQp = searchParams.get("orcamentoId");
      if (orcamentoIdQp) {
        const { data: orc } = await supabase
          .from("orcamentos")
          .select("id, profissional_id")
          .eq("id", orcamentoIdQp)
          .maybeSingle();
        if (orc?.profissional_id) {
          const { data: perfil } = await supabase
            .from("profissional_perfil")
            .select("mp_access_token")
            .eq("user_id", orc.profissional_id)
            .maybeSingle();
          if (perfil?.mp_access_token) {
            console.log(`[Webhook ${requestId}] Refazendo consulta MP com token do profissional ${orc.profissional_id}...`);
            mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
              headers: { Authorization: `Bearer ${perfil.mp_access_token}` },
            });
            if (!mpRes.ok) {
              const errorBody = await mpRes.text();
              throw new Error(`Erro ao buscar pagamento no MP (token=profissional ${orc.profissional_id}): ${mpRes.status} - ${errorBody}`);
            }
          } else {
            const errorBody = await mpRes.text();
            throw new Error(`Erro ao buscar pagamento no MP (token=marketplace; profissional sem mp_access_token): ${mpRes.status} - ${errorBody}`);
          }
        } else {
          const errorBody = await mpRes.text();
          throw new Error(`Erro ao buscar pagamento no MP (token=marketplace; orcamento ${orcamentoIdQp} sem profissional): ${mpRes.status} - ${errorBody}`);
        }
      } else {
        const errorBody = await mpRes.text();
        throw new Error(`Erro ao buscar pagamento no MP (token=marketplace; sem orcamentoId no query): ${mpRes.status} - ${errorBody}`);
      }
    } else if (!mpRes.ok) {
      const errorBody = await mpRes.text();
      throw new Error(`Erro ao buscar pagamento no MP (token=marketplace): ${mpRes.status} - ${errorBody}`);
    }

    const mpPayment = await mpRes.json();
    const orcamentoId = mpPayment.external_reference;
    const mpStatus = mpPayment.status; // approved, rejected, pending, cancelled, etc

    console.log(`[Webhook ${requestId}] Status MP: ${mpStatus} para Orçamento: ${orcamentoId}`);

    if (!orcamentoId) {
      console.warn(`[Webhook ${requestId}] Pagamento sem external_reference. Ignorando.`);
      return new Response(JSON.stringify({ message: "External reference missing" }), {
        status: 200,
      });
    }


    // 3. Mapear status MP para nosso sistema
    let finalStatus = "pending";
    if (mpStatus === "approved") finalStatus = "paid";
    else if (mpStatus === "cancelled") finalStatus = "canceled";
    else if (mpStatus === "rejected") finalStatus = "failed";
    else if (mpStatus === "in_mediation") finalStatus = "pending";

    // Buscar o registro de pagamento alvo. Prioriza o que já tem este gateway_payment_id,
    // senão o mais recente do orçamento. Retenta uma vez (webhook pode chegar antes do insert).
    let targetPagamento: { id: string; metadata: unknown } | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: byGatewayId } = await supabase
        .from("pagamentos")
        .select("id, metadata")
        .eq("orcamento_id", orcamentoId)
        .eq("gateway_payment_id", String(resourceId))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byGatewayId) { targetPagamento = byGatewayId; break; }

      const { data: latest } = await supabase
        .from("pagamentos")
        .select("id, metadata")
        .eq("orcamento_id", orcamentoId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest) { targetPagamento = latest; break; }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
    const currentMetadata = (targetPagamento?.metadata as Record<string, unknown>) || {};

    // 4. Atualizar SOMENTE o registro de pagamento alvo (nunca todos do orçamento)
    let pagamento: Record<string, unknown> | null = null;
    if (targetPagamento) {
      const { data: updated, error: payError } = await supabase
        .from("pagamentos")
        .update({
          gateway_payment_id: String(resourceId),
          gateway_status: mpStatus,
          status: finalStatus,
          paid_at: mpStatus === "approved" ? new Date().toISOString() : null,
          webhook_last_received_at: new Date().toISOString(),
          payment_method_id: mpPayment.payment_method_id,
          installments: mpPayment.installments,
          metadata: {
            ...currentMetadata,
            last_webhook_payload: mpPayment,
            updated_at: new Date().toISOString(),
          },
        })
        .eq("id", targetPagamento.id)
        .select()
        .maybeSingle();

      if (payError) throw payError;
      pagamento = updated as Record<string, unknown> | null;

      // Cancelar tentativas antigas pendentes do mesmo orçamento (duplicadas de checkout)
      if (mpStatus === "approved") {
        await supabase
          .from("pagamentos")
          .update({ status: "canceled" })
          .eq("orcamento_id", orcamentoId)
          .neq("id", targetPagamento.id)
          .in("status", ["pending", "paid"]);
      }
    }

    if (!pagamento) {
      console.warn(
        `[Webhook ${requestId}] Registro de pagamento não encontrado para Orçamento ${orcamentoId}`,
      );
    }

    // 5. Se aprovado, marcar orçamento como PAGO e confirmar reserva de agenda
    if (mpStatus === "approved") {
      console.log(`[Webhook ${requestId}] Marcando Orçamento ${orcamentoId} como PAGO...`);
      
      const { data: existingOrc } = await supabase
        .from("orcamentos")
        .select("tipo_atendimento")
        .eq("id", orcamentoId)
        .maybeSingle();
      const requiresApoio = existingOrc?.tipo_atendimento === "homem_com_apoio_feminino";

      const { data: updatedOrc, error: orcError } = await supabase
        .from("orcamentos")
        .update({
          status: "pago",
          data_pagamento: new Date().toISOString(),
          ...(requiresApoio ? { 
            status_apoio: "buscando",
            valor_apoio_feminino: currentMetadata?.valor_apoio_feminino || null
          } : {})
        })
        .eq("id", orcamentoId)
        .select("id, profissional_id, cliente_id, data_preferida, periodo_preferido, horario_preferido, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orcError) throw orcError;
      if (!updatedOrc) {
        console.warn(`[Webhook ${requestId}] Nenhum orçamento encontrado para id=${orcamentoId} ao atualizar como pago.`);
        return new Response(JSON.stringify({ received: true, skipped: "orcamento_not_found" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      console.log(`[Webhook ${requestId}] Orçamento ${orcamentoId} atualizado com sucesso.`);

      // Criar/atualizar registro de split com valores reais
      // Taxa real do MP por método de pagamento
      const calcularTaxaMP = (mpData: any): number => {
        const method = mpData.payment_method_id || "";
        const installments = mpData.installments || 1;
        const amount = Number(mpData.transaction_amount || 0);

        if (method === "pix") return Math.round(amount * 0.0099 * 100) / 100;
        if (method === "boleto" || method === "ticket") return 3.49;
        if (installments >= 7) return Math.round(amount * 0.0309 * 100) / 100;
        if (installments >= 2) return Math.round(amount * 0.0299 * 100) / 100;
        return Math.round(amount * 0.0498 * 100) / 100; // à vista padrão
      };

      const MARKETPLACE_FEE_PERCENT = 0.15; // 15% comissão plataforma

      const valorTotal = Number((pagamento as any)?.valor_total || 0);
      const taxaGateway = calcularTaxaMP(mpPayment);
      const taxaPlataforma = Math.round(valorTotal * MARKETPLACE_FEE_PERCENT * 100) / 100;
      const valorProfissional = Math.round((valorTotal - taxaGateway - taxaPlataforma) * 100) / 100;

      const { error: splitErr } = await supabase.from("pagamento_splits").upsert({
        orcamento_id: updatedOrc.id,
        pagamento_id: (pagamento as any)?.id,
        profissional_id: updatedOrc.profissional_id,
        cliente_id: updatedOrc.cliente_id,
        valor_total: valorTotal,
        taxa_gateway: taxaGateway,
        taxa_plataforma: taxaPlataforma,
        valor_profissional: valorProfissional,
        status: "aguardando_conclusao",
        disponivel_em: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "orcamento_id" });

      if (splitErr) {
        console.error(`[Webhook ${requestId}] Erro ao criar split:`, splitErr);
      } else {
        console.log(`[Webhook ${requestId}] Split criado/atualizado para Orçamento ${orcamentoId}`);
      }

      // Confirmar reserva de agenda
      console.log(
        `[Webhook ${requestId}] Atualizando reserva de agenda para Orçamento ${orcamentoId}...`,
      );
      const { data: existingBlocks, error: blockErr } = await supabase
        .from("profissional_bloqueios_agenda")
        .update({
          status: "confirmado",
          expires_at: null,
          motivo: "Pagamento confirmado",
        })
        .eq("orcamento_id", orcamentoId)
        .eq("status", "temporario")
        .select();

      if (blockErr) {
        console.error(`[Webhook ${requestId}] Erro ao atualizar reserva:`, blockErr);
      }

      if ((!existingBlocks || existingBlocks.length === 0) && updatedOrc.data_preferida) {
        console.log(
          `[Webhook ${requestId}] Nenhuma reserva temporária encontrada. Criando bloqueio confirmado...`,
        );
        try {
          const { inicio, fim } = calcularIntervaloReserva(
            updatedOrc.data_preferida,
            updatedOrc.periodo_preferido,
            updatedOrc.horario_preferido,
          );

          if (inicio && fim) {
            await supabase.from("profissional_bloqueios_agenda").insert({
              profissional_id: updatedOrc.profissional_id,
              orcamento_id: updatedOrc.id,
              inicio,
              fim,
              status: "confirmado",
              motivo: "Pagamento confirmado (reserva direta)",
            });
          }
        } catch (e_agenda) {
          console.error(`[Webhook ${requestId}] Erro ao criar bloqueio confirmado:`, e_agenda);
        }
      }

      // 6. Criar Notificações
      console.log(`[Webhook ${requestId}] Criando notificações de pagamento confirmado...`);
      if (pagamento && pagamento.cliente_id) {
        // Para o Cliente
        await supabase.from("notificacoes").insert({
          user_id: pagamento.cliente_id,
          titulo: "Pagamento Aprovado",
          mensagem: `Seu pagamento via Mercado Pago foi confirmado! O serviço já consta na agenda do profissional.`,
          orcamento_id: orcamentoId,
          link: `/cliente?tab=pedidos&pedidoId=${orcamentoId}`,
          lida: false,
        });
      }

      if (updatedOrc.profissional_id) {
        // Para o Profissional
        await supabase.from("notificacoes").insert({
          user_id: updatedOrc.profissional_id,
          titulo: "Pagamento Confirmado!",
          mensagem: `O cliente realizou o pagamento via Mercado Pago e o serviço foi agendado definitivamente na sua agenda.`,
          orcamento_id: orcamentoId,
          link: `/profissional?tab=servicos&orcamentoId=${orcamentoId}`,
          lida: false,
        });
      }

      // 7. Criar repasse profissional pendente de forma assíncrona/idempotente
      if (pagamento && pagamento.id) {
        console.log(
          `[Webhook ${requestId}] Criando repasse profissional pendente para pagamento ${pagamento.id}...`,
        );
        try {
          const { error: rpcErr } = await supabase.rpc("criar_repasse_profissional_pendente", {
            p_pagamento_id: pagamento.id,
          });
          if (rpcErr) {
            console.error(`[mercado-pago-webhook] erro ao criar repasse:`, rpcErr);
          } else {
            console.log(
              `[Webhook ${requestId}] Repasse pendente criado com sucesso para pagamento ${pagamento.id}`,
            );
          }
        } catch (e_rpc) {
          console.error(`[mercado-pago-webhook] erro ao criar repasse:`, e_rpc);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[Webhook ${requestId}] ERRO:`, err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
