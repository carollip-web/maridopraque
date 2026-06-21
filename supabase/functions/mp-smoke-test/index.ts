// supabase/functions/mp-smoke-test/index.ts
// ------------------------------------------------------------------
// Smoke test em PRODUÇÃO: autorizar → capturar → estornar → consultar.
// - NÃO toca em pagamentos/orcamentos.
// - Restrito a admins.
// - Persiste log em public.mp_smoke_test_logs (sanitizado).
// ------------------------------------------------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMpAccessToken } from "../_shared/mp-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Mantém apenas campos úteis e não-sensíveis da resposta do MP.
function sanitizeMp(body: any) {
  if (!body || typeof body !== "object") return body;
  const pick = [
    "id",
    "status",
    "status_detail",
    "captured",
    "transaction_amount",
    "transaction_amount_refunded",
    "currency_id",
    "date_created",
    "date_approved",
    "date_last_updated",
    "operation_type",
    "payment_method_id",
    "payment_type_id",
    "installments",
    "external_reference",
    "statement_descriptor",
    "amount",
    "refunds",
  ];
  const out: Record<string, unknown> = {};
  for (const k of pick) if (k in body) out[k] = body[k];
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const steps: Array<Record<string, unknown>> = [];
  const log = (name: string, data: Record<string, unknown>) => {
    steps.push({ step: name, at: new Date().toISOString(), ...data });
  };

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let ambiente = "desconhecido";
  let userId: string | null = null;
  let amount = 1;
  let paymentId: string | null = null;
  let lastMpResponse: unknown = null;
  let finalStatus: string | null = null;
  let ok = false;
  let errCode: string | null = null;
  let errMsg: string | null = null;

  const persist = async () => {
    try {
      await admin.from("mp_smoke_test_logs").insert({
        executed_by: userId,
        ambiente,
        amount,
        payment_id: paymentId,
        status_final: finalStatus,
        ok,
        error: errCode,
        message: errMsg,
        steps,
        request_summary: {
          amount,
          description: "Smoke test Marido pra Quê (autorização)",
          installments: 1,
          capture: false,
        },
        last_mp_response: lastMpResponse,
      } as any);
    } catch (e) {
      console.error("[mp-smoke-test] falha ao gravar log", e);
    }
  };

  try {
    let MP_ACCESS_TOKEN: string;
    try {
      const cred = getMpAccessToken();
      MP_ACCESS_TOKEN = cred.token;
      ambiente = cred.ambiente;
    } catch (e: any) {
      errCode = "CONFIG_ERROR";
      errMsg = e?.message ?? "Credenciais MP inválidas.";
      await persist();
      return json({ ok: false, error: errCode, message: errMsg, steps }, 500);
    }

    // ---- Auth + admin check ---------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      errCode = "UNAUTHORIZED";
      return json({ ok: false, error: errCode, steps }, 401);
    }
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } =
      await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) {
      errCode = "UNAUTHORIZED";
      return json({ ok: false, error: errCode, steps }, 401);
    }
    const user = userData.user;
    userId = user.id;

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      errCode = "FORBIDDEN";
      errMsg = "Apenas admins.";
      await persist();
      return json({ ok: false, error: errCode, message: errMsg, steps }, 403);
    }

    // ---- Body -----------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const cardToken: string | undefined = body?.card_token;
    amount = Number(body?.amount ?? 1);
    if (!cardToken) {
      errCode = "BAD_REQUEST";
      errMsg = "card_token obrigatório.";
      await persist();
      return json({ ok: false, error: errCode, message: errMsg, steps }, 400);
    }
    if (!Number.isFinite(amount) || amount < 0.5 || amount > 50) {
      errCode = "BAD_REQUEST";
      errMsg = "amount deve estar entre 0.50 e 50.00.";
      await persist();
      return json({ ok: false, error: errCode, message: errMsg, steps }, 400);
    }

    log("start", { ambiente, amount, user_id: user.id });

    const baseIdem = `mp-smoke-${user.id}-${Date.now()}`;
    const idem = (suffix: string) => `${baseIdem}-${suffix}`;

    // ---- 1) AUTORIZAR --------------------------------------------
    const idemAuth = idem("auth");
    const authRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idemAuth,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        capture: false,
        description: "Smoke test Marido pra Quê (autorização)",
        installments: 1,
        payer: { email: user.email },
        token: cardToken,
        statement_descriptor: "MARIDO PRA QUE",
      }),
    });
    const authBody = await authRes.json().catch(() => ({}));
    lastMpResponse = sanitizeMp(authBody);
    log("authorize", {
      http_status: authRes.status,
      idempotency_key: idemAuth,
      mp_id: authBody?.id ?? null,
      mp_status: authBody?.status ?? null,
      mp_status_detail: authBody?.status_detail ?? null,
      ok: authRes.ok,
    });

    if (!authRes.ok || !authBody?.id) {
      errCode = "AUTHORIZE_FAILED";
      errMsg = authBody?.message || "Falha na autorização.";
      finalStatus = authBody?.status ?? null;
      await persist();
      return json(
        {
          ok: false,
          ambiente,
          error: errCode,
          message: errMsg,
          steps,
          mp_response: lastMpResponse,
        },
        400,
      );
    }
    paymentId = String(authBody.id);

    // ---- 2) CAPTURAR ---------------------------------------------
    const idemCap = idem("cap");
    const capRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idemCap,
        },
        body: JSON.stringify({ capture: true }),
      },
    );
    const capBody = await capRes.json().catch(() => ({}));
    lastMpResponse = sanitizeMp(capBody);
    log("capture", {
      http_status: capRes.status,
      idempotency_key: idemCap,
      mp_id: capBody?.id ?? paymentId,
      mp_status: capBody?.status ?? null,
      mp_status_detail: capBody?.status_detail ?? null,
      captured: capBody?.captured ?? null,
      ok: capRes.ok,
    });

    if (!capRes.ok || capBody?.status !== "approved") {
      errCode = "CAPTURE_FAILED";
      errMsg = capBody?.message || "Falha na captura.";
      finalStatus = capBody?.status ?? null;
      await persist();
      return json(
        {
          ok: false,
          ambiente,
          error: errCode,
          message: errMsg,
          payment_id: paymentId,
          steps,
          mp_response: lastMpResponse,
        },
        400,
      );
    }

    // ---- 3) ESTORNO ----------------------------------------------
    const idemRef = idem("ref");
    const refRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idemRef,
        },
        body: "{}",
      },
    );
    const refBody = await refRes.json().catch(() => ({}));
    log("refund", {
      http_status: refRes.status,
      idempotency_key: idemRef,
      refund_id: refBody?.id ?? null,
      refund_status: refBody?.status ?? null,
      amount: refBody?.amount ?? null,
      ok: refRes.ok,
    });

    // ---- 4) CONSULTAR --------------------------------------------
    const getRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } },
    );
    const getBody = await getRes.json().catch(() => ({}));
    lastMpResponse = sanitizeMp(getBody);
    finalStatus = getBody?.status ?? null;
    log("get_final", {
      http_status: getRes.status,
      mp_id: paymentId,
      mp_status: getBody?.status ?? null,
      mp_status_detail: getBody?.status_detail ?? null,
      transaction_amount_refunded:
        getBody?.transaction_amount_refunded ?? null,
    });

    ok =
      refRes.ok &&
      (getBody?.status === "refunded" ||
        Number(getBody?.transaction_amount_refunded ?? 0) >= amount);

    await persist();

    return json({
      ok,
      ambiente,
      payment_id: paymentId,
      summary: {
        autorizado: authBody?.status,
        capturado: capBody?.status,
        estornado: ok,
        status_final: finalStatus,
      },
      steps,
      mp_response: lastMpResponse,
    });
  } catch (err: any) {
    console.error("[mp-smoke-test] erro fatal", err);
    errCode = "INTERNAL";
    errMsg = err?.message || "Erro interno.";
    await persist();
    return json(
      { ok: false, error: errCode, message: errMsg, steps },
      500,
    );
  }
});
