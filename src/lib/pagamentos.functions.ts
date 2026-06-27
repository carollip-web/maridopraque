import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const checkoutSchema = z.object({
  orcamentoId: z.string().uuid(),
});

/** Linha retornada pela RPC `criar_checkout_pagamento`. */
interface CriarCheckoutPagamentoRow {
  id: string;
}

/** Item de material lido para o cálculo do total. */
interface OrcamentoMaterialPreco {
  id: string;
  nome_snapshot: string | null;
  preco_unitario: number | null;
  quantidade: number | null;
}

/** Forma mínima da resposta de criação de preferência do Mercado Pago. */
interface MercadoPagoPreferenceResponse {
  id?: string;
  init_point?: string;
  message?: string;
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

export const iniciarPagamentoOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => checkoutSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Buscar orçamento e validar posse/status
    const { data: orc, error: e1 } = await supabase
      .from("orcamentos")
      .select(
        "id, status, cliente_id, profissional_id, service_name, valor, valor_servico, taxa_material, tipo_atendimento",
      )
      .eq("id", data.orcamentoId)
      .single();

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

    const { data: materiais, error: materiaisError } = await supabase
      .from("orcamento_materiais")
      .select("id, nome_snapshot, preco_unitario, quantidade")
      .eq("orcamento_id", data.orcamentoId);

    if (materiaisError) {
      console.error("[iniciarPagamentoOrcamento] Erro ao buscar materiais:", materiaisError);
      throw new Error("Erro ao carregar materiais do orçamento.");
    }

    // 2. Calcular valores no servidor (Fonte de verdade)
    // Modelo: cobrança integral antecipada. Valor fica retido até conclusão.
    const valorServico = Number(orc.valor_servico || 0);
    const valorMateriais = ((materiais ?? []) as OrcamentoMaterialPreco[]).reduce(
      (acc, m) => acc + Number(m.preco_unitario || 0) * Number(m.quantidade || 0),
      0,
    );
    const valorBase = valorServico + valorMateriais;
    const requiresApoio = orc.tipo_atendimento === "homem_com_apoio_feminino";
    const valorApoio = requiresApoio ? Math.round(valorBase * 0.3 * 100) / 100 : 0;
    const valorTotal = Math.round((valorBase + valorApoio) * 100) / 100;
    const valorSinal = valorTotal; // 100% upfront
    const valorRestante = 0;

    if (valorTotal <= 0) {
      throw new Error("O valor total do orçamento deve ser maior que zero.");
    }

    // 3. Integração com Mercado Pago
    const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const APP_URL = process.env.APP_URL || "https://maridopraque.lovable.app";

    if (!ACCESS_TOKEN) {
      throw new Error("Gateway de pagamento não configurado. Contate o suporte.");
    }

    let checkoutUrl = "";
    let preferenceId = "";
    const gateway = "mercado_pago";

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
            title: orc.service_name,
            description: "Serviço via Marido Pra Quê (pagamento integral, retido até conclusão)",
            quantity: 1,
            currency_id: "BRL",
            unit_price: valorTotal,
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

    const mpData = (await mpResponse.json()) as MercadoPagoPreferenceResponse;
    if (!mpResponse.ok) {
      console.error("[Mercado Pago] Erro API:", mpData);
      throw new Error(mpData.message || "Erro na comunicação com Mercado Pago.");
    }

    checkoutUrl = mpData.init_point ?? "";
    preferenceId = mpData.id ?? preferenceId;

    try {
      // 4. Criar registro de pagamento no servidor usando RPC.
      const rpcRes = (await supabase.rpc("criar_checkout_pagamento" as never, {
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
          valor_apoio_feminino: valorApoio,
        },
      } as never)) as unknown as {
        data: CriarCheckoutPagamentoRow[] | CriarCheckoutPagamentoRow | null;
        error: PostgrestError | null;
      };
      const { data: pagRows, error: pagError } = rpcRes;

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

      return {
        ok: true,
        checkoutUrl,
        pagamentoId: pag.id,
      };
    } catch (err: unknown) {
      console.error("[iniciarPagamentoOrcamento] Falha crítica:", err);
      throw new Error(errorMessage(err, "Falha ao processar pagamento."));
    }
  });
