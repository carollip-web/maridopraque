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

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const boletoId: string | undefined = body.boletoId || body.id;
    if (!boletoId) return json({ error: "boletoId obrigatório" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: boleto } = await supabaseAdmin
      .from("btg_boletos")
      .select("*")
      .eq("id", boletoId)
      .maybeSingle();

    if (!boleto) return json({ error: "Boleto não encontrado." }, 404);
    if (boleto.cliente_id !== user.id) return json({ error: "Sem permissão." }, 403);

    // Já pago: retorna status atual sem chamar BTG
    if (boleto.status === "paga" || boleto.status === "pago") {
      return json({ status: "pago", paidAt: boleto.paid_at, amount: Number(boleto.amount) });
    }

    // Credenciais BTG
    const { data: btgConfig } = await supabaseAdmin
      .from("marketplace_integracoes")
      .select("access_token, company_id, token_expires_at, extra")
      .eq("provider", "btg")
      .maybeSingle();

    const companyId = resolveCompanyId(btgConfig);
    if (!btgConfig || !btgConfig.access_token || !companyId) {
      return json({ status: boleto.status });
    }

    const btgEnv = Deno.env.get("BTG_ENV") || "sandbox";
    const btgBaseUrl = btgEnv === "production"
      ? "https://api.empresas.btgpactual.com"
      : "https://api.sandbox.empresas.btgpactual.com";

    const url = `${btgBaseUrl}/v1/${companyId}/banking/payment-link/${encodeURIComponent(boleto.btg_payment_link_id)}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${btgConfig.access_token}`, accept: "application/json" },
    });

    const respText = await resp.text();
    let respJson: any = null;
    try { if (respText) respJson = JSON.parse(respText); } catch { respJson = { rawText: respText }; }

    await supabaseAdmin
      .from("btg_boletos")
      .update({ last_status_check_at: new Date().toISOString() })
      .eq("id", boleto.id);

    if (!resp.ok) {
      console.log("[btg-boleto-status] falha BTG", { status: resp.status });
      return json({ status: boleto.status });
    }

    const btgStatus: string = (respJson?.status || "").toString().toUpperCase();
    const paid = ["PAID", "SETTLED", "CONFIRMED"].includes(btgStatus);
    const paidAtRaw = respJson?.paidAt || respJson?.paymentDate || respJson?.settledAt;

    if (paid) {
      const paidAt = paidAtRaw ? new Date(paidAtRaw).toISOString() : new Date().toISOString();
      const paidAmount = Number(respJson?.paidAmount || respJson?.amountPaid || boleto.amount);

      await supabaseAdmin
        .from("btg_boletos")
        .update({
          status: "pago",
          paid_at: paidAt,
          paid_amount: paidAmount,
          payer_name: respJson?.payer?.name || null,
          payer_tax_id: respJson?.payer?.taxId || null,
          btg_response: respJson,
        })
        .eq("id", boleto.id);

      if (boleto.pagamento_id) {
        await supabaseAdmin
          .from("pagamentos")
          .update({ status: "approved", gateway_status: btgStatus, paid_at: paidAt })
          .eq("id", boleto.pagamento_id);

        await supabaseAdmin
          .from("orcamentos")
          .update({ status: "pago", data_pagamento: paidAt })
          .eq("id", boleto.orcamento_id);

        // dispara repasse pendente
        await supabaseAdmin.rpc("criar_repasse_profissional_pendente", { p_pagamento_id: boleto.pagamento_id });
      }

      return json({ status: "pago", paidAt, amount: paidAmount });
    }

    if (["CANCELLED", "CANCELED", "EXPIRED"].includes(btgStatus)) {
      await supabaseAdmin
        .from("btg_boletos")
        .update({ status: btgStatus === "EXPIRED" ? "expirado" : "cancelado", btg_response: respJson })
        .eq("id", boleto.id);
      return json({ status: btgStatus === "EXPIRED" ? "expirado" : "cancelado" });
    }

    return json({ status: boleto.status, btgStatus });
  } catch (error: any) {
    console.error("[btg-boleto-status] erro", error);
    return json({ error: "Erro ao consultar status do boleto." }, 500);
  }
});
