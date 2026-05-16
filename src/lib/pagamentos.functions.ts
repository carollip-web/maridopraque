import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const checkoutSchema = z.object({
  orcamentoId: z.string().uuid(),
});

export const iniciarPagamentoOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => checkoutSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Buscar orçamento e validar posse/status
    const { data: orc, error: e1 } = await supabase
      .from("orcamentos")
      .select("*, orcamento_materiais(*)")
      .eq("id", data.orcamentoId)
      .single() as any;

    if (e1 || !orc) {
      console.error("[iniciarPagamentoOrcamento] Orçamento não encontrado:", data.orcamentoId);
      throw new Error("Orçamento não encontrado.");
    }
    
    if (orc.cliente_id !== userId) {
      console.warn("[iniciarPagamentoOrcamento] Tentativa de acesso não autorizado por:", userId);
      throw new Error("Sem permissão para este orçamento.");
    }
    
    const statusPagaveis = ["aprovado", "fixo_auto"];
    if (!statusPagaveis.includes(orc.status)) {
      throw new Error(`Orçamento em status "${orc.status}" não está pronto para pagamento.`);
    }

    // 2. Calcular valores no servidor (Fonte de verdade)
    const valorServico = Number(orc.valor_servico || 0);
    const valorMateriais = (orc.orcamento_materiais || []).reduce(
      (acc: number, m: any) => acc + Number(m.preco_unitario || 0) * Number(m.quantidade || 0),
      0
    );
    const valorTotal = valorServico + valorMateriais;
    const valorSinal = valorTotal * 0.5;
    const valorRestante = valorTotal - valorSinal;

    if (valorTotal <= 0) {
      throw new Error("O valor total do orçamento deve ser maior que zero.");
    }

    // 3. Integração com Mercado Pago (ou Mock fallback)
    const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const APP_URL = process.env.APP_URL || "https://maridopraque.lovable.app";

    let checkoutUrl = "";
    let preferenceId = `mock-${Date.now()}`;
    let gateway = "mercado_pago";

    if (!ACCESS_TOKEN) {
      console.warn("[iniciarPagamentoOrcamento] MERCADO_PAGO_ACCESS_TOKEN não configurado. Usando modo Simulação.");
      gateway = "mock";
      // We will set the checkoutUrl after we create the payment record so we can include its ID.
    } else {
      console.info(`[Mercado Pago] Gerando preferência para Orçamento ${orc.id}...`);
      const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              id: orc.id,
              title: `Sinal: ${orc.service_name}`,
              description: "Reserva de serviço via Marido Pra Quê",
              quantity: 1,
              currency_id: "BRL",
              unit_price: valorSinal,
            },
          ],
          external_reference: orc.id,
          notification_url: `${process.env.SUPABASE_URL}/functions/v1/mercado-pago-webhook`, // Supabase Edge Function
          back_urls: {
            success: `${APP_URL}/cliente?tab=pedidos&payment=success`,
            failure: `${APP_URL}/cliente?tab=pedidos&payment=failure`,
            pending: `${APP_URL}/cliente?tab=pedidos&payment=pending`,
          },
          auto_return: "approved",
          statement_descriptor: "MARIDO PRA QUE",
          expires: true,
          expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
        }),
      });

      const mpData = await mpResponse.json();
      if (!mpResponse.ok) {
        console.error("[Mercado Pago] Erro API:", mpData);
        throw new Error(mpData.message || "Erro na comunicação com Mercado Pago.");
      }

      checkoutUrl = mpData.init_point;
      preferenceId = mpData.id;
    }

    try {

      // 4. Criar registro de pagamento no servidor após validar posse/status.
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!SUPABASE_URL || !SERVICE_KEY) {
        throw new Error("Configuração do servidor ausente: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
      }

      const serviceClient = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false },
      });

      const { data: pag, error: e2 } = await serviceClient
        .from("pagamentos")
        .insert({
          orcamento_id: orc.id,
          cliente_id: userId,
          profissional_id: orc.profissional_id,
          valor_total: valorTotal,
          valor_sinal: valorSinal,
          valor_restante: valorRestante,
          status: "checkout_created",
          gateway: gateway,
          gateway_preference_id: preferenceId,
          checkout_url: checkoutUrl || null,
          metadata: {
            service_name: orc.service_name,
            mp_preference_id: preferenceId,
            initiated_at: new Date().toISOString()
          }
        })
        .select()
        .single() as any;

      if (e2) throw new Error(`Erro ao salvar registro de pagamento: ${e2.message}`);

      // If it's mock, we set the checkoutUrl to our internal simulator now that we have the payment ID
      if (gateway === "mock") {
        checkoutUrl = `/checkout/simular?pagamentoId=${pag.id}`;
        
        // Update the payment record with the mock url
        await serviceClient
          .from("pagamentos")
          .update({ checkout_url: checkoutUrl })
          .eq("id", pag.id);
      }

      return { 
        ok: true, 
        checkoutUrl: checkoutUrl,
        pagamentoId: pag.id
      };

    } catch (err: any) {
      console.error("[iniciarPagamentoOrcamento] Falha crítica:", err);
      throw new Error(err.message || "Falha ao processar pagamento.");
    }
  });

const simularSchema = z.object({
  pagamentoId: z.string().uuid(),
});

export const simularPagamentoAprovado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => simularSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error("Configuração do servidor ausente.");
    }

    const serviceClient = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Fetch Payment
    const { data: pag, error: e1 } = await serviceClient
      .from("pagamentos")
      .select("*")
      .eq("id", data.pagamentoId)
      .single() as any;

    if (e1 || !pag) throw new Error("Pagamento não encontrado.");
    if (pag.cliente_id !== userId) throw new Error("Sem permissão para este pagamento.");
    if (pag.status === "paid") return { ok: true, message: "Já estava pago." };

    // 2. Update Pagamento -> paid
    await serviceClient
      .from("pagamentos")
      .update({ status: "paid" })
      .eq("id", pag.id);

    // 3. Update Orcamento -> pago
    await serviceClient
      .from("orcamentos")
      .update({ status: "pago" })
      .eq("id", pag.orcamento_id);

    // 4. Update Bloqueio de Agenda -> confirmada
    await serviceClient
      .from("profissional_bloqueios_agenda")
      .update({ status: "confirmada", expires_at: null })
      .eq("orcamento_id", pag.orcamento_id);

    // 5. Notifications
    // For the Professional
    if (pag.profissional_id) {
      await serviceClient.from("notificacoes").insert({
        user_id: pag.profissional_id,
        titulo: "Pagamento Confirmado!",
        mensagem: `O cliente realizou o pagamento e o serviço foi agendado definitivamente na sua agenda.`,
        orcamento_id: pag.orcamento_id,
        link: `/profissional?tab=servicos&orcamentoId=${pag.orcamento_id}`,
        lida: false
      });
    }

    // For the Client
    await serviceClient.from("notificacoes").insert({
      user_id: pag.cliente_id,
      titulo: "Pagamento Aprovado",
      mensagem: `Seu pagamento foi confirmado! O serviço já consta na agenda do profissional.`,
      orcamento_id: pag.orcamento_id,
      link: `/cliente?tab=pedidos&pedidoId=${pag.orcamento_id}`,
      lida: false
    });

    return { ok: true };
  });
