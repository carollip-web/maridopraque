// redeploy: 2026-05-29
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
    const baseUrl =
      Deno.env.get("APP_BASE_URL") ||
      Deno.env.get("APP_URL") ||
      "https://maridopraque.lovable.app";

    const MARKETPLACE_FEE_PERCENT = 15;

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
      .select("id, cliente_id, profissional_id, status, valor, valor_servico, service_name, tipo_atendimento")
      .eq("id", orcamentoId)
      .maybeSingle();

    if (orcErr || !orcamento) {
      return json({ error: "NOT_FOUND", message: "Orçamento não encontrado." }, 404);
    }

    // Snapshot do endereço do cliente para o profissional ver após o pagamento
    const { data: endereco } = await admin
      .from("cliente_enderecos")
      .select("logradouro, numero, complemento, bairro, cidade, uf, cep, lat, lng")
      .eq("user_id", orcamento.cliente_id)
      .eq("is_padrao", true)
      .maybeSingle();
    if (endereco) {
      await admin.from("orcamentos").update({ endereco_snapshot: endereco } as any).eq("id", orcamento.id);
    }

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
    const valorBase = Number(orcamento.valor || orcamento.valor_servico || 0);
    if (!(valorBase > 0)) {
      return json({ error: "INVALID_VALUE", message: "Valor inválido." }, 400);
    }
    
    // Apoio Feminino logic
    const requiresApoio = orcamento.tipo_atendimento === "homem_com_apoio_feminino";
    const valorApoio = requiresApoio ? Math.round(valorBase * 0.3 * 100) / 100 : 0;
    const valorTotal = valorBase + valorApoio;

    // === SPLIT 1:1 — Buscar access_token do profissional (seller) ===
    const { data: profPerfil, error: profErr } = await admin
      .from("profissional_perfil")
      .select("mp_access_token, mp_expires_at, mp_user_id")
      .eq("user_id", orcamento.profissional_id)
      .maybeSingle();

    if (profErr || !profPerfil?.mp_access_token) {
      console.error("[mercadopago-cartao-criar] profissional sem MP conectado", {
        profissionalId: orcamento.profissional_id,
        profErr,
      });
      return json(
        {
          error: "MP_NOT_CONNECTED",
          message:
            "O profissional deste serviço ainda não conectou sua conta Mercado Pago. " +
            "Aguarde a conexão ou entre em contato com o suporte.",
        },
        400,
      );
    }

    // Verificar expiração do token OAuth do profissional
    if (
      profPerfil.mp_expires_at &&
      new Date(profPerfil.mp_expires_at) < new Date()
    ) {
      console.warn("[mercadopago-cartao-criar] token MP do profissional expirado", {
        profissionalId: orcamento.profissional_id,
        expiresAt: profPerfil.mp_expires_at,
      });
      return json(
        {
          error: "MP_TOKEN_EXPIRED",
          message:
            "O token Mercado Pago do profissional expirou. " +
            "Peça para ele reconectar em Configurações > Mercado Pago.",
        },
        400,
      );
    }

    // Re-buscar token imediatamente antes de usar para evitar race condition com expiração
    const { data: profPerfilFresh } = await admin
      .from("profissional_perfil")
      .select("mp_access_token, mp_expires_at")
      .eq("user_id", orcamento.profissional_id)
      .maybeSingle();

    if (!profPerfilFresh?.mp_access_token) {
      return json({ error: "MP_NOT_CONNECTED", message: "Token do profissional não disponível." }, 400);
    }
    if (profPerfilFresh.mp_expires_at && new Date(profPerfilFresh.mp_expires_at) < new Date()) {
      return json({ error: "MP_TOKEN_EXPIRED", message: "O token Mercado Pago do profissional expirou. Peça para ele reconectar em Configurações > Mercado Pago." }, 400);
    }

    const sellerAccessToken = profPerfilFresh.mp_access_token;
    
    // 15% sobre o valor base do profissional + retenção total do valor do apoio
    const marketplaceFeeBase = Math.round(valorBase * (MARKETPLACE_FEE_PERCENT / 100) * 100) / 100;
    const marketplaceFee = marketplaceFeeBase + valorApoio;

    console.info("[mercadopago-cartao-criar] validado", {
      orcamentoId,
      userId: user.id,
      valorTotal,
      marketplaceFee,
      mpSellerId: profPerfil.mp_user_id,
      valorApoio,
    });

    // Cancela tentativas anteriores pendentes deste orçamento (evita duplicatas)
    await admin
      .from("pagamentos")
      .update({ status: "canceled" } as any)
      .eq("orcamento_id", orcamento.id)
      .eq("status", "pending");

    // Cria registro de pagamento com informações do split
    const { data: pagamento, error: pagErr } = await admin
      .from("pagamentos")
      .insert({
        orcamento_id: orcamento.id,
        cliente_id: orcamento.cliente_id,
        profissional_id: orcamento.profissional_id,
        valor_total: valorTotal,
        valor_sinal: valorTotal,
        valor_restante: 0,
        metodo: "cartao",
        gateway: "mercado_pago",
        status: "pending",
        metadata: {
          split_type: requiresApoio ? "marketplace_with_apoio" : "marketplace_1_1",
          marketplace_fee_percent: MARKETPLACE_FEE_PERCENT,
          marketplace_fee_amount: marketplaceFee,
          mp_seller_user_id: profPerfil.mp_user_id,
          valor_apoio_feminino: valorApoio,
        },
      } as any)
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
          title: orcamento.service_name || "Serviço Marido pra Que",
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(valorTotal),
        },
      ],
      payer: { email: user.email },
      external_reference: orcamento.id,
      marketplace_fee: marketplaceFee,
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
      notification_url: `${SUPABASE_URL}/functions/v1/mercado-pago-webhook?orcamentoId=${orcamento.id}`,
      statement_descriptor: "MARIDO PRA QUE",
      payment_methods: {
        installments: 12,
      },
    };

    // SPLIT 1:1: usar access_token do profissional (seller) conforme doc MP
    // marketplace_fee é descontado automaticamente pelo MP
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sellerAccessToken}`,
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
