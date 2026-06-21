// supabase/functions/mp-smoke-test/index.ts
// ------------------------------------------------------------------
// Fluxo de smoke test em PRODUÇÃO: autorizar → capturar → estornar.
// NÃO toca em pagamentos/orcamentos. Apenas valida que credenciais e
// fluxo MP estão saudáveis ponta a ponta.
// Restrito a usuários com role 'admin'.
// ------------------------------------------------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMpAccessToken, getMpAmbiente } from "../_shared/mp-credentials.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const steps: Array<Record<string, unknown>> = [];
  const log = (name: string, data: Record<string, unknown>) => {
    steps.push({ step: name, at: new Date().toISOString(), ...data });
  };

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let MP_ACCESS_TOKEN: string;
    let ambiente: string;
    try {
      const cred = getMpAccessToken();
      MP_ACCESS_TOKEN = cred.token;
      ambiente = cred.ambiente;
    } catch (e: any) {
      return json(
        { ok: false, error: "CONFIG_ERROR", message: e?.message },
        500,
      );
    }

    // ---- Auth + admin check ---------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "UNAUTHORIZED" }, 401);

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ ok: false, error: "UNAUTHORIZED" }, 401);
    }
    const user = userData.user;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return json({ ok: false, error: "FORBIDDEN", message: "Apenas admins." }, 403);
    }

    // ---- Body -----------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const cardToken: string | undefined = body?.card_token;
    const amount = Number(body?.amount ?? 1);
    if (!cardToken) {
      return json(
        { ok: false, error: "BAD_REQUEST", message: "card_token obrigatório." },
        400,
      );
    }
    if (!Number.isFinite(amount) || amount < 0.5 || amount > 50) {
      return json(
        {
          ok: false,
          error: "BAD_REQUEST",
          message: "amount deve estar entre 0.50 e 50.00 para o teste.",
        },
        400,
      );
    }

    log("start", { ambiente, amount, user_id: user.id });

    const idem = (suffix: string) =>
      `mp-smoke-${user.id}-${Date.now()}-${suffix}`;

    // ---- 1) AUTORIZAR (capture:false) -----------------------------
    const authPayload = {
      transaction_amount: amount,
      capture: false,
      description: "Smoke test Marido pra Quê (autorização)",
      installments: 1,
      payer: { email: user.email },
      token: cardToken,
      statement_descriptor: "MARIDO PRA QUE",
    };
    const authRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idem("auth"),
      },
      body: JSON.stringify(authPayload),
    });
    const authBody = await authRes.json().catch(() => ({}));
    log("authorize", {
      http_status: authRes.status,
      mp_id: authBody?.id ?? null,
      mp_status: authBody?.status ?? null,
      mp_status_detail: authBody?.status_detail ?? null,
      ok: authRes.ok,
    });

    if (!authRes.ok || !authBody?.id) {
      return json(
        {
          ok: false,
          ambiente,
          error: "AUTHORIZE_FAILED",
          message: "Falha na autorização.",
          steps,
          mp_response: authBody,
        },
        400,
      );
    }
    const paymentId = String(authBody.id);

    // ---- 2) CAPTURAR (PUT capture:true) ---------------------------
    const capRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idem("cap"),
        },
        body: JSON.stringify({ capture: true }),
      },
    );
    const capBody = await capRes.json().catch(() => ({}));
    log("capture", {
      http_status: capRes.status,
      mp_status: capBody?.status ?? null,
      mp_status_detail: capBody?.status_detail ?? null,
      captured: capBody?.captured ?? null,
      ok: capRes.ok,
    });

    if (!capRes.ok || capBody?.status !== "approved") {
      return json(
        {
          ok: false,
          ambiente,
          error: "CAPTURE_FAILED",
          payment_id: paymentId,
          steps,
          mp_response: capBody,
        },
        400,
      );
    }

    // ---- 3) ESTORNO TOTAL -----------------------------------------
    const refRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idem("ref"),
        },
        body: "{}",
      },
    );
    const refBody = await refRes.json().catch(() => ({}));
    log("refund", {
      http_status: refRes.status,
      refund_id: refBody?.id ?? null,
      refund_status: refBody?.status ?? null,
      amount: refBody?.amount ?? null,
      ok: refRes.ok,
    });

    // ---- 4) CONSULTAR STATUS FINAL --------------------------------
    const getRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } },
    );
    const getBody = await getRes.json().catch(() => ({}));
    log("get_final", {
      http_status: getRes.status,
      mp_status: getBody?.status ?? null,
      mp_status_detail: getBody?.status_detail ?? null,
      transaction_amount_refunded: getBody?.transaction_amount_refunded ?? null,
    });

    const refundedOk =
      refRes.ok &&
      (getBody?.status === "refunded" ||
        Number(getBody?.transaction_amount_refunded ?? 0) >= amount);

    return json({
      ok: refundedOk,
      ambiente,
      payment_id: paymentId,
      summary: {
        autorizado: authBody?.status,
        capturado: capBody?.status,
        estornado: refundedOk,
        status_final: getBody?.status,
      },
      steps,
    });
  } catch (err: any) {
    console.error("[mp-smoke-test] erro fatal", err);
    return json(
      { ok: false, error: "INTERNAL", message: err?.message, steps },
      500,
    );
  }
});
