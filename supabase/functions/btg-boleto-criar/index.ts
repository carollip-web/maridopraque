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

  console.log("[btg-boleto-criar] start");

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Idempotência: reaproveita boleto pendente recente
    const { data: boletoAtivo } = await supabaseAdmin
      .from("btg_boletos")
      .select("*")
      .eq("orcamento_id", orcamento_id)
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (boletoAtivo && new Date(boletoAtivo.due_date) >= new Date()) {
      if (boletoAtivo.cliente_id !== user.id) return json({ error: "Sem permissão." }, 403);
      return json({
        id: boletoAtivo.id,
        paymentUrl: boletoAtivo.payment_url,
        amount: Number(boletoAtivo.amount),
        dueDate: boletoAtivo.due_date,
        status: boletoAtivo.status,
      });
    }

    // Credenciais BTG
    const { data: btgConfig } = await supabaseAdmin
      .from("marketplace_integracoes")
      .select("access_token, company_id, token_expires_at, scope, extra")
      .eq("provider", "btg")
      .maybeSingle();

    const companyId = resolveCompanyId(btgConfig);

    if (!btgConfig || !btgConfig.access_token || !companyId) {
      return json({ error: "Configuração BTG ausente." }, 400);
    }
    const tokenExpired = btgConfig.token_expires_at
      ? new Date(btgConfig.token_expires_at) <= new Date()
      : true;
    if (tokenExpired) return json({ error: "Sessão BTG expirada. Reconecte." }, 401);

    const hasScope = typeof btgConfig.scope === "string" &&
      btgConfig.scope.includes("brn:btg:empresas:payment-link");
    if (!hasScope) {
      return json({ error: "Permissão BTG insuficiente para boleto. Reconecte a integração BTG." }, 403);
    }

    // Orçamento
    const { data: orcamento } = await supabaseAdmin
      .from("orcamentos")
      .select("id, cliente_id, profissional_id, status, valor_servico, service_name")
      .eq("id", orcamento_id)
      .maybeSingle();

    if (!orcamento) return json({ error: "Pedido não encontrado." }, 404);
    if (orcamento.cliente_id !== user.id) return json({ error: "Sem permissão." }, 403);
    if (!["aprovado", "fixo_auto"].includes(orcamento.status)) {
      return json({ error: "Pedido ainda não está aprovado para pagamento." }, 400);
    }
    const valor = Number(orcamento.valor_servico || 0);
    if (valor <= 0) return json({ error: "Valor do pedido inválido." }, 400);

    const codigoCurto = String(orcamento_id).slice(0, 8).toUpperCase();
    const externalId = `BOL-${codigoCurto}-${Date.now().toString(36)}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const btgPayload = {
      externalId,
      type: "SINGLE",
      paymentMethods: ["BANKSLIP"],
      amount: valor,
      dueDate: dueDateStr,
      description: `Marido pra Quê - Pedido #${codigoCurto}`,
    };

    const btgEnv = Deno.env.get("BTG_ENV") || "sandbox";
    const btgBaseUrl = btgEnv === "production"
      ? "https://api.empresas.btgpactual.com"
      : "https://api.sandbox.empresas.btgpactual.com";
    const btgRequestUrl = `${btgBaseUrl}/v1/${companyId}/banking/payment-link`;

    console.log("[btg-boleto-criar] chamando BTG", { env: btgEnv, amount: valor, dueDate: dueDateStr });

    const btgResponse = await fetch(btgRequestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${btgConfig.access_token}`,
        "Content-Type": "application/json",
        "x-idempotency-key": externalId,
      },
      body: JSON.stringify(btgPayload),
    });

    const responseText = await btgResponse.text();
    let responseJson: any = null;
    try { if (responseText) responseJson = JSON.parse(responseText); }
    catch { responseJson = { rawText: responseText }; }

    if (!btgResponse.ok) {
      console.log("[btg-boleto-criar] falha BTG", { status: btgResponse.status, body: responseJson });
      return json({ error: "Erro ao criar boleto BTG." },
        btgResponse.status === 401 || btgResponse.status === 403 ? btgResponse.status : 400);
    }

    const paymentLinkId = responseJson?.id || responseJson?.paymentLinkId || externalId;
    const paymentUrl = responseJson?.url || responseJson?.paymentUrl || responseJson?.shortUrl || null;

    if (!paymentUrl) {
      console.log("[btg-boleto-criar] BTG retornou sem url", responseJson);
      return json({ error: "Resposta BTG sem link de pagamento." }, 502);
    }

    // Cria pagamento
    const { data: pagamento, error: pagErr } = await supabaseAdmin
      .from("pagamentos")
      .insert({
        orcamento_id,
        cliente_id: orcamento.cliente_id,
        profissional_id: orcamento.profissional_id,
        valor_total: valor,
        status: "pending",
        gateway: "btg_boleto",
        gateway_payment_id: String(paymentLinkId),
        metodo: "boleto",
      })
      .select("id")
      .single();

    if (pagErr) {
      console.error("[btg-boleto-criar] erro insert pagamentos", pagErr);
      return json({ error: "Erro ao registrar pagamento." }, 500);
    }

    const { data: boleto, error: bolErr } = await supabaseAdmin
      .from("btg_boletos")
      .insert({
        orcamento_id,
        pagamento_id: pagamento.id,
        cliente_id: orcamento.cliente_id,
        btg_payment_link_id: String(paymentLinkId),
        external_id: externalId,
        amount: valor,
        due_date: dueDateStr,
        payment_url: paymentUrl,
        status: "pendente",
        btg_request: btgPayload,
        btg_response: responseJson,
      })
      .select("id")
      .single();

    if (bolErr) {
      console.error("[btg-boleto-criar] erro insert btg_boletos", bolErr);
      return json({ error: "Erro ao registrar boleto." }, 500);
    }

    console.log("[btg-boleto-criar] boleto criado", { id: boleto.id, paymentLinkId });

    return json({
      id: boleto.id,
      paymentUrl,
      amount: valor,
      dueDate: dueDateStr,
      status: "pendente",
    });
  } catch (error: any) {
    console.error("[btg-boleto-criar] erro fatal", error);
    return json({ error: "Erro ao criar boleto BTG." }, 500);
  }
});
