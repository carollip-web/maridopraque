// Edge function: processar-estorno
// Dispara o estorno no gateway (Mercado Pago ou BTG) quando admin/cliente
// cancela um pedido já pago. Lê o valor de reembolso de pagamento_splits.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Authenticate caller
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const callerId = userData.user.id;

  let body: { orcamentoId?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const orcamentoId = body.orcamentoId;
  if (!orcamentoId) return json({ error: "orcamentoId obrigatório" }, 400);

  // Carrega pedido + pagamento + split
  const { data: orc, error: orcErr } = await admin
    .from("orcamentos")
    .select("id, cliente_id, status")
    .eq("id", orcamentoId)
    .single();
  if (orcErr || !orc) return json({ error: "Pedido não encontrado" }, 404);

  // Caller deve ser o cliente OU um admin
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
  if (orc.cliente_id !== callerId && !isAdmin) {
    return json({ error: "Sem permissão" }, 403);
  }

  const { data: pag } = await admin
    .from("pagamentos")
    .select("id, gateway, gateway_payment_id, valor_total, status")
    .eq("orcamento_id", orcamentoId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pag) return json({ ok: true, skipped: "nenhum pagamento confirmado" });

  const { data: split } = await admin
    .from("pagamento_splits")
    .select("id, valor_reembolso, status, motivo_cancelamento")
    .eq("orcamento_id", orcamentoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const valorReembolso = Number(split?.valor_reembolso || 0);
  if (valorReembolso <= 0) {
    return json({ ok: true, skipped: "sem valor a reembolsar", regra: split?.motivo_cancelamento });
  }

  // Mercado Pago
  if ((pag.gateway || "").toLowerCase().includes("mercado") || pag.gateway === "mp") {
    if (!MP_ACCESS_TOKEN) return json({ error: "MERCADO_PAGO_ACCESS_TOKEN ausente" }, 500);
    if (!pag.gateway_payment_id) return json({ error: "gateway_payment_id ausente" }, 400);

    const idem = `refund-${orcamentoId}-${Date.now()}`;
    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${pag.gateway_payment_id}/refunds`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idem,
      },
      body: JSON.stringify({ amount: Number(valorReembolso.toFixed(2)) }),
    });
    const txt = await resp.text();
    let parsed: any; try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt }; }
    if (!resp.ok) {
      console.error("[processar-estorno] MP refund falhou", resp.status, parsed);
      return json({ error: "Falha no estorno MP", details: parsed }, 502);
    }
    console.info("[processar-estorno] MP refund ok", parsed?.id);

    await admin.from("notificacoes").insert({
      user_id: orc.cliente_id,
      titulo: "Reembolso enviado",
      mensagem: `Reembolso de R$ ${valorReembolso.toFixed(2)} foi solicitado ao Mercado Pago. Deve cair em até 14 dias.`,
      orcamento_id: orcamentoId,
      link: `/cliente?tab=pedidos&pedidoId=${orcamentoId}`,
    });

    return json({ ok: true, gateway: "mercado_pago", refundId: parsed?.id, valor: valorReembolso });
  }


  return json({ error: `Gateway desconhecido: ${pag.gateway}` }, 400);
});
