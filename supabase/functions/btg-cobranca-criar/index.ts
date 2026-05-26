import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function resolveCompanyId(config: any): string | null {
  return config?.company_id
    || config?.extra?.token_response?.company_id
    || config?.extra?.token_response?.["empresas.btgpactual.com/pix-cash-in"]
    || config?.extra?.token_response?.["empresas.btgpactual.com/accounts"]
    || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  console.log("[btg-cobranca-criar] start");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({
        error: "AUTH_MISSING",
        message: "Authorization Bearer ausente.",
      }, 401);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return json({ error: "AUTH_INVALID", message: "Sessão inválida." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const orcamento_id = body.orcamentoId || body.orcamento_id;
    if (!orcamento_id) {
      return json({ error: "BAD_REQUEST", message: "orcamentoId obrigatório." }, 400);
    }

    const btgPixKey = Deno.env.get("BTG_PIX_KEY_RECEBEDORA");
    if (!btgPixKey) {
      return json({
        error: "BTG_PIX_KEY_MISSING",
        message: "BTG_PIX_KEY_RECEBEDORA ausente nas secrets da Edge Function.",
      }, 500);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Idempotência: reaproveita cobrança ativa não expirada
    const { data: cobrancaAtiva } = await supabaseAdmin
      .from("btg_cobrancas")
      .select("*")
      .eq("orcamento_id", orcamento_id)
      .eq("status", "ativa")
      .maybeSingle();

    if (cobrancaAtiva && cobrancaAtiva.expires_at && new Date(cobrancaAtiva.expires_at) > new Date()) {
      if (cobrancaAtiva.cliente_id !== user.id) {
        return json({ error: "FORBIDDEN", message: "Sem permissão." }, 403);
      }
      console.log("[btg-cobranca-criar] reaproveitando cobrança ativa", { txId: cobrancaAtiva.tx_id });
      return json({
        txId: cobrancaAtiva.tx_id,
        emv: cobrancaAtiva.emv,
        qrcode_url: cobrancaAtiva.qrcode_url,
        status: "ATIVA",
        expiresAt: cobrancaAtiva.expires_at,
        amount: Number(cobrancaAtiva.amount),
        orcamentoId: orcamento_id,
        cobrancaId: cobrancaAtiva.id,
      });
    }

    if (cobrancaAtiva) {
      await supabaseAdmin
        .from("btg_cobrancas")
        .update({ status: "expirada" })
        .eq("id", cobrancaAtiva.id);
    }

    // Credenciais BTG
    const { data: btgConfig } = await supabaseAdmin
      .from("marketplace_integracoes")
      .select("access_token, company_id, token_expires_at, scope, extra")
      .eq("provider", "btg")
      .maybeSingle();

    const companyId = resolveCompanyId(btgConfig);

    if (!btgConfig || !btgConfig.access_token || !companyId) {
      return json({
        error: "BTG_CONFIG_MISSING",
        message: "Configuração BTG ausente ou incompleta em marketplace_integracoes.",
      }, 400);
    }
    const tokenExpired = btgConfig.token_expires_at
      ? new Date(btgConfig.token_expires_at) <= new Date()
      : true;
    if (tokenExpired) {
      return json({
        error: "BTG_TOKEN_EXPIRED",
        message: "Sessão BTG expirada. Reconecte a integração BTG.",
      }, 401);
    }

    const hasScope = typeof btgConfig.scope === "string" &&
      btgConfig.scope.includes("empresas.btgpactual.com/pix-cash-in");
    if (!hasScope) {
      return json({
        error: "BTG_SCOPE_MISSING",
        message: "Permissão BTG insuficiente para Pix Cash-In. Reconecte a integração BTG.",
      }, 403);
    }

    // Orçamento
    const { data: orcamento } = await supabaseAdmin
      .from("orcamentos")
      .select("id, cliente_id, profissional_id, status, valor_servico")
      .eq("id", orcamento_id)
      .maybeSingle();

    if (!orcamento) {
      return json({ error: "ORCAMENTO_NOT_FOUND", message: "Pedido não encontrado." }, 404);
    }
    if (orcamento.cliente_id !== user.id) {
      return json({ error: "FORBIDDEN", message: "Sem permissão." }, 403);
    }
    if (!["aprovado", "fixo_auto"].includes(orcamento.status)) {
      return json({
        error: "INVALID_STATUS",
        message: "Pedido ainda não está aprovado para pagamento.",
      }, 400);
    }
    const valorServico = Number(orcamento.valor_servico || 0);
    if (valorServico <= 0) {
      return json({ error: "INVALID_VALUE", message: "Valor do pedido inválido." }, 400);
    }

    console.info("[btg-cobranca-criar] validado", {
      orcamentoId: orcamento_id,
      userId: user.id,
      valorServico,
      status: orcamento.status,
    });

    // Payload BTG. Idempotency key única por tentativa para evitar reaproveitamento
    // de tx_id no sandbox quando a cobrança anterior já expirou.
    const idempotencyKey = `${orcamento_id}-${Date.now()}`;
    const codigoCurto = String(orcamento_id).slice(0, 8).toUpperCase();
    const btgPayload = {
      pixKey: btgPixKey,
      amount: { original: valorServico, allowCustomerChangeValue: false },
      expiresIn: 3600,
      displayText: `Marido pra Quê - Pedido #${codigoCurto}`,
    };

    console.info("[btg-cobranca-criar] payload keys", {
      keys: Object.keys(btgPayload),
      hasPixKey: !!btgPixKey,
      amount: valorServico,
    });

    const btgEnv = Deno.env.get("BTG_ENV") || "sandbox";
    console.log("[btg-cobranca-criar] BTG_ENV lido:", btgEnv, "baseUrl será:",
      btgEnv === "production"
        ? "https://api.empresas.btgpactual.com"
        : "https://api.sandbox.empresas.btgpactual.com"
    );
    const btgBaseUrl = btgEnv === "production"
      ? "https://api.empresas.btgpactual.com"
      : "https://api.sandbox.empresas.btgpactual.com";
    const btgRequestUrl = `${btgBaseUrl}/v1/companies/${companyId}/pix-cash-in/instant-collections`;

    console.log("[btg-cobranca-criar] chamando BTG", { env: btgEnv, amount: valorServico });

    const btgResponse = await fetch(btgRequestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${btgConfig.access_token}`,
        "Content-Type": "application/json",
        "x-idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(btgPayload),
    });

    const responseText = await btgResponse.text();
    let responseJson: any = null;
    try { if (responseText) responseJson = JSON.parse(responseText); }
    catch { responseJson = { rawText: responseText }; }

    console.info("[btg-cobranca-criar] response keys", {
      keys: Object.keys(responseJson || {}),
      status: btgResponse.status,
    });

    if (!btgResponse.ok) {
      console.error("[btg-cobranca-criar] falha BTG", {
        status: btgResponse.status,
        body: responseJson,
      });
      const btgMessage =
        responseJson?.message ||
        responseJson?.error ||
        responseJson?.details?.[0]?.message ||
        responseJson?.rawText ||
        "Erro ao criar cobrança Pix BTG.";
      return json({
        error: "BTG_PIX_API_ERROR",
        message: btgMessage,
        status: btgResponse.status,
        btgBody: responseJson,
      }, btgResponse.status === 401 || btgResponse.status === 403 ? btgResponse.status : 400);
    }

    const txId = responseJson?.txId || responseJson?.id || responseJson?.data?.txId;
    const emv = responseJson?.emv || responseJson?.brCode || responseJson?.copyPaste || responseJson?.data?.emv;
    const qrcodeUrl =
      responseJson?.location?.url ||
      responseJson?.qrCodeUrl ||
      responseJson?.data?.location?.url ||
      null;
    const expiresAt = responseJson?.expiresAt || new Date(Date.now() + 3600 * 1000).toISOString();

    if (!txId || !emv) {
      console.error("[btg-cobranca-criar] resposta BTG inválida", {
        keys: Object.keys(responseJson || {}),
        hasTxId: !!txId,
        hasEmv: !!emv,
      });
      return json({
        error: "BTG_PIX_RESPONSE_INVALID",
        message: "BTG retornou cobrança Pix sem txId ou código copia e cola.",
        btgBody: responseJson,
      }, 502);
    }

    // Se BTG (sandbox) devolveu o mesmo tx_id de uma cobrança anterior,
    // reaproveita o registro em vez de violar unique constraint.
    const { data: existenteByTx } = await supabaseAdmin
      .from("btg_cobrancas")
      .select("id, cliente_id")
      .eq("tx_id", txId)
      .maybeSingle();

    if (existenteByTx) {
      if (existenteByTx.cliente_id !== user.id) {
        return json({ error: "FORBIDDEN", message: "Sem permissão." }, 403);
      }
      await supabaseAdmin
        .from("btg_cobrancas")
        .update({
          status: "ativa",
          emv,
          qrcode_url: qrcodeUrl,
          amount: valorServico,
          expires_at: expiresAt,
          btg_request: btgPayload,
          btg_response: responseJson,
        })
        .eq("id", existenteByTx.id);

      console.log("[btg-cobranca-criar] tx_id reaproveitado pelo BTG; reusando registro", {
        txId, cobrancaId: existenteByTx.id,
      });

      return json({
        txId,
        emv,
        qrcode_url: qrcodeUrl,
        status: "ATIVA",
        expiresAt,
        amount: valorServico,
        orcamentoId: orcamento_id,
        cobrancaId: existenteByTx.id,
      });
    }

    // Cria pagamento + cobrança
    const { data: pagamento, error: pagErr } = await supabaseAdmin
      .from("pagamentos")
      .insert({
        orcamento_id,
        cliente_id: orcamento.cliente_id,
        profissional_id: orcamento.profissional_id,
        valor_total: valorServico,
        status: "pending",
        gateway: "btg_pix",
        gateway_payment_id: txId,
        metodo: "pix",
      })
      .select("id")
      .single();

    if (pagErr) {
      console.error("[btg-cobranca-criar] erro insert pagamentos", pagErr);
      return json({
        error: "PAYMENT_INSERT_ERROR",
        message: pagErr.message,
        details: pagErr.details,
        hint: pagErr.hint,
        code: pagErr.code,
      }, 500);
    }

    const { data: cobranca, error: cobErr } = await supabaseAdmin
      .from("btg_cobrancas")
      .insert({
        orcamento_id,
        pagamento_id: pagamento.id,
        cliente_id: orcamento.cliente_id,
        tx_id: txId,
        emv,
        qrcode_url: qrcodeUrl,
        amount: valorServico,
        status: "ativa",
        expires_at: expiresAt,
        btg_request: btgPayload,
        btg_response: responseJson,
      })
      .select("id")
      .single();

    if (cobErr) {
      console.error("[btg-cobranca-criar] erro insert btg_cobrancas", cobErr);
      return json({
        error: "BTG_COBRANCA_INSERT_ERROR",
        message: cobErr.message,
        details: cobErr.details,
        hint: cobErr.hint,
        code: cobErr.code,
      }, 500);
    }

    console.log("[btg-cobranca-criar] cobrança criada", { txId, cobrancaId: cobranca.id });

    return json({
      txId,
      emv,
      qrcode_url: qrcodeUrl,
      status: "ATIVA",
      expiresAt,
      amount: valorServico,
      orcamentoId: orcamento_id,
      cobrancaId: cobranca.id,
    });
  } catch (error: any) {
    console.error("[btg-cobranca-criar] erro fatal", error);
    return json({
      error: "UNEXPECTED_PIX_ERROR",
      message: error?.message || "Erro inesperado ao criar Pix BTG.",
    }, 500);
  }
});
