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

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const txId = body.txId || body.tx_id;
    if (!txId) return json({ error: "txId obrigatório" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: cobranca } = await supabaseAdmin
      .from("btg_cobrancas")
      .select("*")
      .eq("tx_id", txId)
      .maybeSingle();

    if (!cobranca) return json({ error: "Cobrança não encontrada" }, 404);
    if (cobranca.cliente_id !== user.id) return json({ error: "Sem permissão" }, 403);

    if (cobranca.status === "paga") {
      return json({ status: "paga", paid_at: cobranca.paid_at });
    }

    // Consulta BTG
    const { data: btgConfig } = await supabaseAdmin
      .from("marketplace_integracoes")
      .select("access_token, company_id, token_expires_at, extra")
      .eq("provider", "btg")
      .maybeSingle();

    const companyId = resolveCompanyId(btgConfig);

    if (!btgConfig?.access_token || !companyId) {
      return json({ status: cobranca.status });
    }

    const btgEnv = Deno.env.get("BTG_ENV") || "sandbox";
    const baseUrl = btgEnv === "production"
      ? "https://api.empresas.btgpactual.com"
      : "https://api.sandbox.empresas.btgpactual.com";
    const url = `${baseUrl}/v1/companies/${companyId}/pix-cash-in/instant-collections/${txId}`;

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${btgConfig.access_token}` },
    });
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.log("[btg-cobranca-status] BTG erro", { status: resp.status, data });
      return json({ status: cobranca.status });
    }

    const btgStatus = String(data?.status || "").toUpperCase();

    if (btgStatus === "PAID") {
      const paidAt = data?.paidAt || new Date().toISOString();
      const paidAmount = Number(data?.paidAmount ?? data?.amount ?? cobranca.amount);

      await supabaseAdmin
        .from("btg_cobrancas")
        .update({
          status: "paga",
          paid_at: paidAt,
          paid_amount: paidAmount,
          payer_tax_id: data?.paidBy?.taxId ?? null,
          payer_name: data?.paidBy?.name ?? null,
          btg_response: data,
        })
        .eq("id", cobranca.id);

      if (cobranca.pagamento_id) {
        await supabaseAdmin
          .from("pagamentos")
          .update({
            status: "approved",
            gateway_status: "PAID",
            paid_at: paidAt,
            webhook_last_received_at: new Date().toISOString(),
          })
          .eq("id", cobranca.pagamento_id);

        await supabaseAdmin.rpc("criar_repasse_profissional_pendente", {
          p_pagamento_id: cobranca.pagamento_id,
        });
      }

      await supabaseAdmin
        .from("orcamentos")
        .update({ status: "pago", data_pagamento: paidAt })
        .eq("id", cobranca.orcamento_id);

      return json({ status: "paga", paid_at: paidAt });
    }

    if (btgStatus === "EXPIRED") {
      await supabaseAdmin
        .from("btg_cobrancas")
        .update({ status: "expirada" })
        .eq("id", cobranca.id);
      return json({ status: "expirada" });
    }

    return json({ status: cobranca.status, btg_status: btgStatus });
  } catch (error: any) {
    console.error("[btg-cobranca-status] erro fatal", error);
    return json({ error: "Erro ao consultar status" }, 500);
  }
});
