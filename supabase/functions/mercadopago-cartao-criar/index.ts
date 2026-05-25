import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.info("[mercadopago-cartao-criar] start");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const accessToken =
      Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ||
      Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    const baseUrl =
      Deno.env.get("APP_BASE_URL") ||
      Deno.env.get("APP_URL") ||
      "https://maridopraque.lovable.app";

    if (!accessToken) {
      return json(
        {
          error: "MP_ENV_MISSING",
          message: "MERCADOPAGO_ACCESS_TOKEN ausente nas Edge Functions.",
        },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "UNAUTHORIZED", message: "Token ausente." }, 401);
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      return json({ error: "UNAUTHORIZED", message: "Sessão inválida." }, 401);
    }
    const user = userData.user;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "BAD_REQUEST", message: "Body inválido." }, 400);
    }
    const orcamentoId: string | undefined = body?.orcamentoId;
    if (!orcamentoId) {
      return json({ error: "BAD_REQUEST", message: "orcamentoId obrigatório." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: orcamento, error: orcErr } = await admin
      .from("orcamentos")
      .select("id, cliente_id, profissional_id, status, valor, valor_servico, service_name")
      .eq("id", orcamentoId)
      .maybeSingle();

    if (orcErr || !orcamento) {
      return json({ error: "NOT_FOUND", message: "Orçamento não encontrado." }, 404);
    }
    if (orcamento.cliente_id !== user.id) {
      return json({ error: "FORBIDDEN", message: "Sem permissão para este orçamento." }, 403);
    }
    if (orcamento.status !== "aprovado") {
      return json(
        {
          error: "INVALID_STATUS",
          message: `Pedido em status "${orcamento.status}" não está liberado para pagamento.`,
        },
        400,
      );
    }
    const valor = Number(orcamento.valor || orcamento.valor_servico || 0);
    if (!(valor > 0)) {
      return json({ error: "INVALID_VALUE", message: "Valor inválido." }, 400);
    }

    console.info("[mercadopago-cartao-criar] validado", {
      orcamentoId,
      userId: user.id,
      valor,
    });

    // Cria registro de pagamento
    const { data: pagamento, error: pagErr } = await admin
      .from("pagamentos")
      .insert({
        orcamento_id: orcamento.id,
        cliente_id: orcamento.cliente_id,
        profissional_id: orcamento.profissional_id,
        valor_total: valor,
        valor_sinal: valor,
        valor_restante: 0,
        metodo: "cartao",
        gateway: "mercado_pago",
        status: "pending",
      })
      .select("id")
      .single();

    if (pagErr || !pagamento) {
      console.error("[mercadopago-cartao-criar] erro criar pagamento", pagErr);
      return json(
        { error: "DB_ERROR", message: pagErr?.message || "Erro ao criar pagamento." },
        500,
      );
    }

    const preferencePayload = {
      items: [
        {
          id: orcamento.id,
          title: orcamento.service_name || "Serviço Marido pra Quê",
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(valor),
        },
      ],
      payer: { email: user.email },
      external_reference: pagamento.id,
      metadata: {
        orcamento_id: orcamento.id,
        pagamento_id: pagamento.id,
        cliente_id: user.id,
      },
      back_urls: {
        success: `${baseUrl}/cliente?tab=pedidos&payment=success&gateway=mercadopago`,
        failure: `${baseUrl}/checkout?orcamentoId=${orcamento.id}&payment=failure`,
        pending: `${baseUrl}/checkout?orcamentoId=${orcamento.id}&payment=pending`,
      },
      auto_return: "approved",
      notification_url: `${SUPABASE_URL}/functions/v1/mercado-pago-webhook`,
      statement_descriptor: "MARIDO PRA QUE",
      payment_methods: {
        excluded_payment_types: [
          { id: "ticket" },
          { id: "bank_transfer" },
          { id: "atm" },
        ],
        installments: 12,
      },
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpBody = await mpRes.json().catch(() => ({}));

    if (!mpRes.ok) {
      console.error("[mercadopago-cartao-criar] MP API error", {
        status: mpRes.status,
        mpBody,
      });
      await admin
        .from("pagamentos")
        .update({ status: "failed" })
        .eq("id", pagamento.id);
      await admin.from("mercadopago_preferencias").insert({
        orcamento_id: orcamento.id,
        pagamento_id: pagamento.id,
        cliente_id: user.id,
        status: "failed",
        mp_request: preferencePayload,
        mp_response: mpBody,
      });
      return json(
        {
          error: "MP_API_ERROR",
          message: mpBody?.message || "Erro na API do Mercado Pago.",
          status: mpRes.status,
          mpBody,
        },
        502,
      );
    }

    const checkoutUrl: string = mpBody.init_point || mpBody.sandbox_init_point;

    await admin.from("mercadopago_preferencias").insert({
      orcamento_id: orcamento.id,
      pagamento_id: pagamento.id,
      cliente_id: user.id,
      mp_preference_id: mpBody.id,
      init_point: mpBody.init_point,
      sandbox_init_point: mpBody.sandbox_init_point,
      status: "created",
      mp_request: preferencePayload,
      mp_response: mpBody,
    });

    await admin
      .from("pagamentos")
      .update({
        gateway_preference_id: mpBody.id,
        checkout_url: checkoutUrl,
      })
      .eq("id", pagamento.id);

    console.info("[mercadopago-cartao-criar] preference criada", {
      preferenceId: mpBody.id,
      pagamentoId: pagamento.id,
    });

    return json({ ok: true, checkoutUrl, pagamentoId: pagamento.id, preferenceId: mpBody.id });
  } catch (err: any) {
    console.error("[mercadopago-cartao-criar] erro fatal", err);
    return json(
      { error: "INTERNAL", message: err?.message || "Erro interno." },
      500,
    );
  }
});
