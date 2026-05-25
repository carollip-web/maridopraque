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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  console.log("[btg-cobranca-criar] start");

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const orcamento_id = body.orcamentoId || body.orcamento_id;
    if (!orcamento_id) return json({ error: "Pedido não encontrado." }, 400);

    const btgPixKey = Deno.env.get("BTG_PIX_KEY_RECEBEDORA");
    if (!btgPixKey) return json({ error: "Configuração BTG ausente." }, 500);

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
      if (cobrancaAtiva.cliente_id !== user.id) return json({ error: "Sem permissão." }, 403);
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

    // Se existe ativa mas expirada, marca expirada
    if (cobrancaAtiva) {
      await supabaseAdmin
        .from("btg_cobrancas")
        .update({ status: "expirada" })
        .eq("id", cobrancaAtiva.id);
    }

    // Credenciais BTG
    const { data: btgConfig } = await supabaseAdmin
      .from("marketplace_integracoes")
      .select("access_token, company_id, token_expires_at, scope")
      .eq("provider", "btg")
      .maybeSingle();

    if (!btgConfig || !btgConfig.access_token || !btgConfig.company_id) {
      return json({ error: "Configuração BTG ausente." }, 400);
    }
    const tokenExpired = btgConfig.token_expires_at
      ? new Date(btgConfig.token_expires_at) <= new Date()
      : true;
    if (tokenExpired) return json({ error: "Configuração BTG ausente." }, 401);

    const hasScope = typeof btgConfig.scope === "string" &&
      btgConfig.scope.includes("empresas.btgpactual.com/pix-cash-in");
    if (!hasScope) return json({ error: "Configuração BTG ausente." }, 403);

    // Orçamento
    const { data: orcamento } = await supabaseAdmin
      .from("orcamentos")
      .select("id, cliente_id, profissional_id, status, valor_servico")
      .eq("id", orcamento_id)
      .maybeSingle();

    if (!orcamento) return json({ error: "Pedido não encontrado." }, 404);
    if (orcamento.cliente_id !== user.id) return json({ error: "Sem permissão." }, 403);
    if (!["aprovado", "fixo_auto"].includes(orcamento.status)) {
      return json({ error: "Pedido ainda não está aprovado para pagamento." }, 400);
    }
    const valorServico = Number(orcamento.valor_servico || 0);
    if (valorServico <= 0) return json({ error: "Valor do pedido inválido." }, 400);

    // Payload BTG
    const codigoCurto = String(orcamento_id).slice(0, 8).toUpperCase();
    const btgPayload = {
      pixKey: btgPixKey,
      amount: { original: valorServico, allowCustomerChangeValue: false },
      expiresIn: 3600,
      displayText: `Marido pra Quê - Pedido #${codigoCurto}`,
    };

    const btgEnv = Deno.env.get("BTG_ENV") || "sandbox";
    const btgBaseUrl = btgEnv === "production"
      ? "https://api.empresas.btgpactual.com"
      : "https://api.sandbox.empresas.btgpactual.com";
    const btgRequestUrl = `${btgBaseUrl}/v1/companies/${btgConfig.company_id}/pix-cash-in/instant-collections`;

    console.log("[btg-cobranca-criar] chamando BTG", { env: btgEnv, amount: valorServico });

    const btgResponse = await fetch(btgRequestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${btgConfig.access_token}`,
        "Content-Type": "application/json",
        "x-idempotency-key": orcamento_id,
      },
      body: JSON.stringify(btgPayload),
    });

    const responseText = await btgResponse.text();
    let responseJson: any = null;
    try { if (responseText) responseJson = JSON.parse(responseText); }
    catch { responseJson = { rawText: responseText }; }

    if (!btgResponse.ok) {
      console.log("[btg-cobranca-criar] falha BTG", { status: btgResponse.status, body: responseJson });
      return json({ error: "Erro ao criar cobrança Pix BTG." },
        btgResponse.status === 401 || btgResponse.status === 403 ? btgResponse.status : 400);
    }

    const txId = responseJson?.txId;
    const emv = responseJson?.emv;
    const qrcodeUrl = responseJson?.location?.url ?? responseJson?.qrCodeUrl ?? null;
    const expiresAt = responseJson?.expiresAt || new Date(Date.now() + 3600 * 1000).toISOString();

    if (!txId) {
      console.log("[btg-cobranca-criar] BTG retornou sem txId", responseJson);
      return json({ error: "Resposta BTG inválida." }, 502);
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
      return json({ error: "Erro ao registrar pagamento." }, 500);
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
      return json({ error: "Erro ao registrar cobrança." }, 500);
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
    return json({ error: "Erro ao criar cobrança Pix BTG." }, 500);
  }
});
