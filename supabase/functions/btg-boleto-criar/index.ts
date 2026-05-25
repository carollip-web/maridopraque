import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function pickFirstString(...values: unknown[]): string | undefined {
  const value = values.find((item) =>
    (typeof item === "string" && item.trim().length > 0) || typeof item === "number"
  );
  return typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : undefined;
}

function normalizeBrazilPhone(value?: string | null): string | null {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return digits;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits.slice(2);
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  console.info("[btg-boleto-criar] start");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "AUTH_MISSING", message: "Authorization Bearer ausente." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "ENV_MISSING", message: "Configuração Supabase ausente." }, 500);
    }

    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return json({ error: "AUTH_INVALID", message: "Usuário não autenticado." }, 401);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "INVALID_JSON", message: "Body inválido." }, 400);
    }
    const orcamento_id = body?.orcamentoId || body?.orcamento_id;
    if (!orcamento_id) {
      return json({ error: "ORCAMENTO_ID_MISSING", message: "orcamentoId é obrigatório." }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Credenciais BTG
    const { data: btgConfig } = await supabaseAdmin
      .from("marketplace_integracoes")
      .select("access_token, company_id, account_id, token_expires_at, scope, extra")
      .eq("provider", "btg")
      .maybeSingle();

    const companyId = resolveCompanyId(btgConfig);

    const btgClientId = Deno.env.get("BTG_CLIENT_ID");
    const btgClientSecret = Deno.env.get("BTG_CLIENT_SECRET");
    if (!btgClientId || !btgClientSecret) {
      return json({ error: "BTG_ENV_MISSING", message: "Credenciais BTG ausentes na Edge Function." }, 500);
    }

    if (!btgConfig || !btgConfig.access_token || !companyId) {
      return json({ error: "BTG_CONFIG_MISSING", message: "Configuração BTG ausente." }, 400);
    }
    const tokenExpired = btgConfig.token_expires_at
      ? new Date(btgConfig.token_expires_at) <= new Date()
      : true;
    if (tokenExpired) return json({ error: "BTG_TOKEN_EXPIRED", message: "Sessão BTG expirada. Reconecte." }, 401);

    const hasScope = typeof btgConfig.scope === "string" &&
      btgConfig.scope.includes("brn:btg:empresas:payment-link");
    if (!hasScope) {
      return json({
        error: "BTG_SCOPE_MISSING",
        message: "Permissão BTG insuficiente para boleto. Reconecte a integração BTG.",
      }, 403);
    }

    // Orçamento
    const { data: orcamento, error: orcError } = await supabaseAdmin
      .from("orcamentos")
      .select("id, cliente_id, profissional_id, status, valor, valor_servico, service_name")
      .eq("id", orcamento_id)
      .maybeSingle();

    if (orcError) {
      console.error("[btg-boleto-criar] erro ao buscar orçamento", orcError);
      return json({ error: "ORCAMENTO_FETCH_ERROR", message: orcError.message }, 400);
    }
    if (!orcamento) {
      return json({ error: "ORCAMENTO_NOT_FOUND", message: "Pedido não encontrado." }, 404);
    }
    if (orcamento.cliente_id !== user.id) {
      return json({ error: "FORBIDDEN", message: "Você não tem permissão para pagar este pedido." }, 403);
    }
    if (orcamento.status !== "aprovado") {
      return json({
        error: "INVALID_STATUS",
        message: `Pedido com status ${orcamento.status}, esperado aprovado.`,
      }, 400);
    }
    const valor = Number(orcamento.valor_servico ?? orcamento.valor ?? 0);
    if (!Number.isFinite(valor) || valor <= 0) {
      return json({ error: "INVALID_AMOUNT", message: "Valor do pedido inválido para pagamento." }, 400);
    }

    // Idempotência: reaproveita boleto pendente recente após validar posse/status do pedido.
    const { data: boletoAtivo } = await supabaseAdmin
      .from("btg_boletos")
      .select("*")
      .eq("orcamento_id", orcamento_id)
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (boletoAtivo && new Date(boletoAtivo.due_date) >= new Date()) {
      return json({
        id: boletoAtivo.id,
        paymentUrl: boletoAtivo.payment_url,
        amount: Number(boletoAtivo.amount),
        dueDate: boletoAtivo.due_date,
        status: boletoAtivo.status,
      });
    }

    const { data: clienteProfile } = await supabaseAdmin
      .from("profiles")
      .select("whatsapp")
      .eq("id", user.id)
      .maybeSingle();
    const notificationPhone = normalizeBrazilPhone(
      pickFirstString(body.whatsapp, body.phone, clienteProfile?.whatsapp, user.phone, user.user_metadata?.whatsapp, user.user_metadata?.phone),
    );
    if (!notificationPhone) {
      return json({
        error: "CUSTOMER_PHONE_MISSING",
        message: "Informe um WhatsApp válido no perfil antes de gerar boleto.",
      }, 400);
    }

    const codigoCurto = String(orcamento_id).slice(0, 8).toUpperCase();
    const externalId = `BOL-${codigoCurto}-${Date.now().toString(36)}`;
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 3);
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const btgEnv = Deno.env.get("BTG_ENV") || "sandbox";
    const btgBaseUrl = Deno.env.get("BTG_BASE_URL") || (btgEnv === "production"
      ? "https://api.empresas.btgpactual.com"
      : "https://api.sandbox.empresas.btgpactual.com");

    console.info("[btg-boleto-criar] validado", {
      orcamentoId: orcamento_id,
      userId: user.id,
      valor,
      status: orcamento.status,
    });

    // Buscar conta bancária BTG (account é obrigatório)
    const accountsResp = await fetch(`${btgBaseUrl}/${companyId}/banking/accounts`, {
      headers: {
        Authorization: `Bearer ${btgConfig.access_token}`,
        Accept: "application/json",
      },
    });
    const accountsText = await accountsResp.text();
    let accountsJson: any = null;
    try { if (accountsText) accountsJson = JSON.parse(accountsText); } catch { /* ignore */ }
    if (!accountsResp.ok) {
      console.log("[btg-boleto-criar] erro accounts", { status: accountsResp.status, body: accountsJson });
      return json({ error: "BTG_ACCOUNTS_ERROR", message: "Não foi possível obter a conta BTG da empresa." }, 502);
    }
    const btgAccount = Array.isArray(accountsJson?.data) ? accountsJson.data[0] : null;
    if (!btgAccount) {
      return json({ error: "BTG_ACCOUNT_NOT_FOUND", message: "Empresa BTG sem conta bancária disponível." }, 502);
    }

    const account: Record<string, string | undefined> = {
      branch: pickFirstString(
        btgAccount.branch,
        btgAccount.branchCode,
        btgAccount.branch_code,
        btgAccount.agency,
        btgAccount.agencyNumber,
        btgAccount.agency_number,
        "50",
      ),
      number: pickFirstString(
        btgAccount.number,
        btgAccount.accountNumber,
        btgAccount.account_number,
        btgAccount.account,
        btgAccount.accountId,
        btgConfig.account_id,
      ),
    };

    Object.keys(account).forEach((key) => {
      if (!account[key]) delete account[key];
    });

    if (!account.branch || !account.number) {
      console.log("[btg-boleto-criar] conta BTG incompleta", {
        accountKeys: Object.keys(btgAccount),
        hasBranch: !!account.branch,
        hasNumber: !!account.number,
      });
      return json({ error: "BTG_ACCOUNT_INCOMPLETE", message: "Conta BTG incompleta para emissão de boleto." }, 502);
    }

    const btgPayload: any = {
      name: `Pedido #${codigoCurto}`,
      amount: valor,
      description: `Marido pra Quê - ${orcamento.service_name || "Serviço"} (#${codigoCurto})`,
      type: "SINGLE",
      paymentMethods: ["BANKSLIPS"],
      account,
      notification: {
        deliveryMediums: user.email ? ["Email", "Sms"] : ["Sms"],
        ...(user.email ? { email: user.email } : {}),
        phone: notificationPhone,
      },
      schedule: {
        startAt: fmt(now),
        endAt: fmt(dueDate),
      },
    };

    const btgRequestUrl = `${btgBaseUrl}/${companyId}/banking/payment-link`;

    console.log("[btg-boleto-criar] chamando BTG", { env: btgEnv, amount: valor, dueDate: dueDateStr, url: btgRequestUrl });

    const btgResponse = await fetch(btgRequestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${btgConfig.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
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
      return json({
        error: "BTG_PAYMENT_LINK_ERROR",
        message: responseJson?.message || responseJson?.error || "Erro ao criar boleto BTG.",
      },
        btgResponse.status === 401 || btgResponse.status === 403 ? btgResponse.status : 400);
    }

    const paymentLinkId = responseJson?.paymentLnkId || responseJson?.id || responseJson?.paymentLinkId || externalId;
    const rawUrl = responseJson?.linkUrl || responseJson?.url || responseJson?.paymentUrl || responseJson?.shortUrl || null;
    const paymentUrl = rawUrl
      ? (rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`)
      : null;

    if (!paymentUrl) {
      console.log("[btg-boleto-criar] BTG retornou sem url", responseJson);
      return json({ error: "BTG_PAYMENT_URL_MISSING", message: "Resposta BTG sem link de pagamento." }, 502);
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
      return json({ error: "PAYMENT_INSERT_ERROR", message: "Erro ao registrar pagamento." }, 500);
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
      return json({ error: "BOLETO_INSERT_ERROR", message: "Erro ao registrar boleto." }, 500);
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
    return json({ error: "UNEXPECTED_ERROR", message: "Erro ao criar boleto BTG." }, 500);
  }
});
