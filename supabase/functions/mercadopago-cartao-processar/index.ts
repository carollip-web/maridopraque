// Checkout Transparente (Payment Brick): cria pagamento no /v1/payments com split via application_fee.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function calcularIntervaloReserva(
  dataPreferida: string | Date,
  periodo?: string | null,
  horario?: string | null,
) {
  const data = String(dataPreferida).slice(0, 10);
  if (periodo === "manha") return { inicio: `${data}T08:00:00-03:00`, fim: `${data}T12:00:00-03:00` };
  if (periodo === "tarde") return { inicio: `${data}T13:00:00-03:00`, fim: `${data}T18:00:00-03:00` };
  if (periodo === "noite") return { inicio: `${data}T18:00:00-03:00`, fim: `${data}T21:00:00-03:00` };
  if (periodo === "horario_especifico" && horario) {
    const hora = String(horario).slice(0, 5);
    const inicioDate = new Date(`${data}T${hora}:00-03:00`);
    const fimDate = new Date(inicioDate.getTime() + 2 * 60 * 60 * 1000);
    return { inicio: inicioDate.toISOString(), fim: fimDate.toISOString() };
  }
  return { inicio: `${data}T08:00:00-03:00`, fim: `${data}T12:00:00-03:00` };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MARKETPLACE_FEE_PERCENT = 15;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "UNAUTHORIZED" }, 401);

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) return json({ error: "UNAUTHORIZED" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const orcamentoId: string | undefined = body?.orcamentoId;
    const formData = body?.formData;
    if (!orcamentoId || !formData?.token || !formData?.payment_method_id) {
      return json({ error: "BAD_REQUEST", message: "Dados do cartão ausentes." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: orcamento } = await admin
      .from("orcamentos")
      .select("id, cliente_id, profissional_id, status, valor, valor_servico, service_name, tipo_atendimento")
      .eq("id", orcamentoId)
      .maybeSingle();
    if (!orcamento) return json({ error: "NOT_FOUND" }, 404);
    if (orcamento.cliente_id !== user.id) return json({ error: "FORBIDDEN" }, 403);
    if (orcamento.status !== "aprovado")
      return json({ error: "INVALID_STATUS", message: `Pedido em "${orcamento.status}" não está liberado.` }, 400);

    const { data: materiais } = await admin
      .from("orcamento_materiais")
      .select("preco_unitario, quantidade")
      .eq("orcamento_id", orcamentoId);
    const valorMateriais = (materiais || []).reduce(
      (acc: number, m: any) => acc + Number(m.preco_unitario || 0) * Number(m.quantidade || 0),
      0,
    );
    const valorBase = Number(orcamento.valor_servico || orcamento.valor || 0) + valorMateriais;
    if (!(valorBase > 0)) return json({ error: "INVALID_VALUE" }, 400);

    const requiresApoio = orcamento.tipo_atendimento === "homem_com_apoio_feminino";
    const valorApoio = requiresApoio ? Math.round(valorBase * 0.3 * 100) / 100 : 0;
    const valorTotal = Math.round((valorBase + valorApoio) * 100) / 100;
    const marketplaceFeeBase = Math.round(valorBase * (MARKETPLACE_FEE_PERCENT / 100) * 100) / 100;
    const applicationFee = Math.round((marketplaceFeeBase + valorApoio) * 100) / 100;

    const { data: perfil } = await admin
      .from("profissional_perfil")
      .select("mp_access_token, mp_expires_at, mp_user_id")
      .eq("user_id", orcamento.profissional_id)
      .maybeSingle();
    if (!perfil?.mp_access_token)
      return json({ error: "MP_NOT_CONNECTED", message: "Profissional sem MP conectado." }, 400);
    if (perfil.mp_expires_at && new Date(perfil.mp_expires_at) < new Date())
      return json({ error: "MP_TOKEN_EXPIRED", message: "Token do profissional expirou." }, 400);

    // Cria registro de pagamento
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
          checkout_type: "transparent_brick",
          split_type: requiresApoio ? "marketplace_with_apoio" : "marketplace_1_1",
          marketplace_fee_percent: MARKETPLACE_FEE_PERCENT,
          application_fee_amount: applicationFee,
          mp_seller_user_id: perfil.mp_user_id,
          valor_apoio_feminino: valorApoio,
        },
      } as any)
      .select("id")
      .single();
    if (pagErr || !pagamento) {
      console.error("[mercadopago-cartao-processar] db error", pagErr);
      return json({ error: "DB_ERROR", message: pagErr?.message }, 500);
    }

    const paymentPayload: Record<string, unknown> = {
      transaction_amount: valorTotal,
      token: formData.token,
      description: orcamento.service_name || "Serviço Marido pra Que",
      installments: Number(formData.installments) || 1,
      payment_method_id: formData.payment_method_id,
      issuer_id: formData.issuer_id,
      payer: {
        email: formData?.payer?.email || user.email,
        identification: formData?.payer?.identification,
      },
      application_fee: applicationFee,
      external_reference: orcamento.id,
      notification_url: `${SUPABASE_URL}/functions/v1/mercado-pago-webhook`,
      statement_descriptor: "MARIDO PRA QUE",
      metadata: {
        orcamento_id: orcamento.id,
        pagamento_id: pagamento.id,
        cliente_id: user.id,
      },
    };

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perfil.mp_access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": pagamento.id,
      },
      body: JSON.stringify(paymentPayload),
    });
    const mpBody = await mpRes.json().catch(() => ({}));

    if (!mpRes.ok) {
      console.error("[mercadopago-cartao-processar] MP error", { status: mpRes.status, mpBody });
      await admin.from("pagamentos").update({ status: "failed", metadata: { ...((pagamento as any).metadata || {}), mp_error: mpBody } } as any).eq("id", pagamento.id);
      return json(
        {
          error: "MP_API_ERROR",
          message: mpBody?.message || mpBody?.cause?.[0]?.description || "Erro na API do Mercado Pago.",
          status: mpRes.status,
          mpBody,
        },
        502,
      );
    }

    const mpStatus: string = mpBody.status; // approved | in_process | rejected | pending
    const mpStatusDetail: string = mpBody.status_detail || "";
    const localStatus =
      mpStatus === "approved" ? "paid" : mpStatus === "rejected" ? "failed" : "pending";

    const updatePayload: Record<string, unknown> = {
      gateway_payment_id: String(mpBody.id),
      status: localStatus,
    };
    if (localStatus === "paid") updatePayload.paid_at = new Date().toISOString();

    await admin.from("pagamentos").update(updatePayload as any).eq("id", pagamento.id);

    // Atualiza o orçamento quando aprovado (a Checkout Pro fazia isso via webhook)
    if (localStatus === "paid") {
      const { error: orcErr } = await admin
        .from("orcamentos")
        .update({ status: "pago", updated_at: new Date().toISOString() } as any)
        .eq("id", orcamento.id);
      if (orcErr) console.error("[mercadopago-cartao-processar] erro update orcamento", orcErr);
    }

    return json({
      ok: true,
      pagamentoId: pagamento.id,
      status: mpStatus,
      statusDetail: mpStatusDetail,
      paymentId: mpBody.id,
    });
  } catch (err: any) {
    console.error("[mercadopago-cartao-processar] erro fatal", err);
    return json({ error: "INTERNAL", message: err?.message || "Erro interno." }, 500);
  }
});
