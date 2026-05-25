import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  console.log("[btg-pix-webhook] received");

  try {
    const secret = Deno.env.get("BTG_WEBHOOK_SECRET");
    if (!secret) {
      console.error("[btg-pix-webhook] BTG_WEBHOOK_SECRET ausente");
      return new Response("Server misconfigured", { status: 500 });
    }

    const auth = req.headers.get("authorization") || "";
    const provided = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : auth.trim();
    if (!provided || !timingSafeEqual(provided, secret)) {
      console.warn("[btg-pix-webhook] auth inválida");
      return new Response("Unauthorized", { status: 401 });
    }

    const rawBody = await req.text();
    let payload: any;
    try { payload = JSON.parse(rawBody); }
    catch { return new Response("Bad payload", { status: 400 }); }

    const event = payload?.event || payload?.type;
    const data = payload?.data || payload;
    const txId = data?.txId || data?.tx_id;

    console.log("[btg-pix-webhook] event", { event, txId });

    if (!event || !txId) return new Response("ok"); // ack mesmo sem dados

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: cobranca } = await supabaseAdmin
      .from("btg_cobrancas")
      .select("*")
      .eq("tx_id", txId)
      .maybeSingle();

    if (!cobranca) {
      console.warn("[btg-pix-webhook] cobrança não encontrada", { txId });
      return new Response("ok"); // ack — não retentar
    }

    if (event === "instant-collection.paid" || event === "PAID") {
      if (cobranca.status === "paga") {
        console.log("[btg-pix-webhook] já marcada paga", { txId });
        return new Response("ok");
      }

      const paidAt = data?.paidAt || new Date().toISOString();
      const paidAmount = Number(data?.paidAmount ?? data?.amount ?? cobranca.amount);

      await supabaseAdmin
        .from("btg_cobrancas")
        .update({
          status: "paga",
          paid_at: paidAt,
          paid_amount: paidAmount,
          payer_tax_id: data?.paidBy?.taxId ?? data?.payer?.taxId ?? null,
          payer_name: data?.paidBy?.name ?? data?.payer?.name ?? null,
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

        const { data: repasseId, error: repErr } = await supabaseAdmin
          .rpc("criar_repasse_profissional_pendente", { p_pagamento_id: cobranca.pagamento_id });

        if (repErr) console.error("[btg-pix-webhook] erro repasse", repErr);
        else console.log("[btg-pix-webhook] repasse criado", { repasseId });
      }

      // Marca orçamento como pago
      await supabaseAdmin
        .from("orcamentos")
        .update({ status: "pago", data_pagamento: paidAt })
        .eq("id", cobranca.orcamento_id);

      return new Response("ok");
    }

    if (event === "instant-collection.unlinked" || event === "UNLINKED") {
      await supabaseAdmin
        .from("btg_cobrancas")
        .update({ status: "desvinculada", btg_response: data })
        .eq("id", cobranca.id);
      return new Response("ok");
    }

    console.log("[btg-pix-webhook] evento não tratado", { event });
    return new Response("ok");
  } catch (error: any) {
    console.error("[btg-pix-webhook] erro fatal", error);
    return new Response("Internal error", { status: 500 });
  }
});
