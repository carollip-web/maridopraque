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
    const { data: orc, error: e1 } = (await supabase
      .from("orcamentos")
      .select(
        "id, status, cliente_id, profissional_id, service_name, valor, valor_servico, taxa_material",
      )
      .eq("id", data.orcamentoId)
      .single()) as any;

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

    const { data: materiais, error: materiaisError } = (await supabase
      .from("orcamento_materiais")
      .select("id, nome_snapshot, preco_unitario, quantidade")
      .eq("orcamento_id", data.orcamentoId)) as any;

    if (materiaisError) {
      console.error("[iniciarPagamentoOrcamento] Erro ao buscar materiais:", materiaisError);
      throw new Error("Erro ao carregar materiais do orçamento.");
    }

    // 2. Calcular valores no servidor (Fonte de verdade)
    const valorServico = Number(orc.valor_servico || 0);
    const valorMateriais = (materiais || []).reduce(
      (acc: number, m: any) => acc + Number(m.preco_unitario || 0) * Number(m.quantidade || 0),
      0,
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
      console.warn(
        "[iniciarPagamentoOrcamento] MERCADO_PAGO_ACCESS_TOKEN não configurado. Usando modo Simulação.",
      );
      gateway = "mock";
      // We will set the checkoutUrl after we create the payment record so we can include its ID.
    } else {
      console.info(`[Mercado Pago] Gerando preferência para Orçamento ${orc.id}...`);
      const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
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
      // 4. Criar registro de pagamento no servidor usando RPC.
      const { data: pagRows, error: pagError } = await (supabase as any)
        .rpc("criar_checkout_pagamento", {
          _orcamento_id: orc.id,
          _valor_total: valorTotal,
          _valor_sinal: valorSinal,
          _valor_restante: valorRestante,
          _gateway: gateway,
          _gateway_preference_id: preferenceId,
          _checkout_url: checkoutUrl || "",
          _metadata: {
            service_name: orc.service_name,
            mp_preference_id: preferenceId,
            initiated_at: new Date().toISOString(),
          },
        });

      if (pagError) {
        console.error("[iniciarPagamentoOrcamento] erro na RPC criar_checkout_pagamento", {
          code: pagError.code,
          message: pagError.message,
          details: pagError.details,
          hint: pagError.hint,
          orcamentoId: orc.id,
        });

        throw new Error(`Erro ao salvar registro de pagamento: ${pagError.message}`);
      }

      const pag = Array.isArray(pagRows) ? pagRows[0] : pagRows;

      if (!pag?.id) {
        throw new Error("Pagamento não foi criado.");
      }

      // If it's mock, we set the checkoutUrl to our internal simulator now that we have the payment ID
      if (gateway === "mock") {
        checkoutUrl = `/checkout/simular?pagamentoId=${pag.id}`;
      }

      return {
        ok: true,
        checkoutUrl,
        pagamentoId: pag.id,
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

    const { data: resultRows, error } = await (supabase as any)
      .rpc("simular_pagamento_aprovado_cliente", {
        _pagamento_id: data.pagamentoId,
      });

    if (error) {
      console.error("[simularPagamentoAprovado] erro na RPC", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        pagamentoId: data.pagamentoId,
      });

      throw new Error(error.message || "Erro ao simular pagamento.");
    }

    const result = Array.isArray(resultRows) ? resultRows[0] : resultRows;

    return {
      ok: !!result?.ok,
      orcamentoId: result?.orcamento_id,
    };
  });
