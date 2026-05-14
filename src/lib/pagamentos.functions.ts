import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    // 3. Integração com Mercado Pago
    const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const APP_URL = process.env.APP_URL || "https://maridopraque.lovable.app";

    if (!ACCESS_TOKEN) {
      console.error("[iniciarPagamentoOrcamento] MERCADO_PAGO_ACCESS_TOKEN não configurado.");
      return { 
        ok: false, 
        message: "O sistema de pagamentos está em configuração. Por favor, utilize o pagamento direto com o profissional por enquanto." 
      };
    }

    try {
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
          notification_url: `${APP_URL}/api/mercado-pago-webhook`, // Webhook a ser criado
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

      const checkoutUrl = mpData.init_point;
      const preferenceId = mpData.id;

      // 4. Criar registro de pagamento
      const { data: pag, error: e2 } = await supabase
        .from("pagamentos")
        .insert({
          orcamento_id: orc.id,
          cliente_id: userId,
          profissional_id: orc.profissional_id,
          valor_total: valorTotal,
          valor_sinal: valorSinal,
          valor_restante: valorRestante,
          status: "checkout_created",
          gateway: "mercado_pago",
          gateway_preference_id: preferenceId,
          checkout_url: checkoutUrl,
          metadata: {
            service_name: orc.service_name,
            mp_preference_id: preferenceId,
            initiated_at: new Date().toISOString()
          }
        })
        .select()
        .single() as any;

      if (e2) throw new Error(`Erro ao salvar registro de pagamento: ${e2.message}`);

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
