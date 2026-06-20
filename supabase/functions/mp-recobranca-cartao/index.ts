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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });


  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

    if (!MP_ACCESS_TOKEN) return json({ error: "CONFIG_ERROR", message: "Token do MP ausente." }, 500);

    const body = await req.json().catch(() => ({}));
    const { orcamento_id } = body;

    if (!orcamento_id) return json({ error: "BAD_REQUEST" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Buscar pagamento
    const { data: pagamento, error: pagErr } = await admin
      .from("pagamentos")
      .select("*")
      .eq("orcamento_id", orcamento_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pagErr || !pagamento) {
      return json({ error: "NOT_FOUND", message: "Pagamento não encontrado." }, 404);
    }

    if (pagamento.status_autorizacao === "capturado") {
      return json({ error: "ALREADY_CAPTURED", message: "Pagamento já foi capturado." }, 400);
    }

    const { valor_total, cliente_id } = pagamento;
    
    // 2. Incrementar tentativas_cobranca e atualizar ultima_tentativa_em
    const novasTentativas = (pagamento.tentativas_cobranca || 0) + 1;
    const now = new Date().toISOString();

    await admin.from("pagamentos").update({
      tentativas_cobranca: novasTentativas,
      ultima_tentativa_em: now
    } as any).eq("id", pagamento.id);

    // 3. Sem CVV disponível (cliente não presente), não é possível gerar token
    //    de uso único via /v1/card_tokens. Vamos direto ao fallback: gerar
    //    link de pagamento avulso (Checkout Pro) e notificar o cliente.
    const prefPayload = {
      items: [
        {
          title: "Serviço Marido pra Que - Recobrança Pendente",
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(valor_total)
        }
      ],
      external_reference: orcamento_id
    };

    const prefRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(prefPayload)
    });
    const prefBody = await prefRes.json().catch(() => ({}));
    const linkAvulso = prefBody.init_point || prefBody.sandbox_init_point;

    const newMetadata = {
      ...pagamento.metadata,
      link_pagamento_avulso: linkAvulso,
      recobranca_motivo: "CVV indisponível no servidor - fallback automático para link avulso",
    };

    await admin.from("pagamentos").update({
      status_autorizacao: "falhou",
      metadata: newMetadata
    } as any).eq("id", pagamento.id);

    // Marcar conta do cliente com pagamento_pendente = true
    const { error: profErr } = await admin.from("profiles").update({ pagamento_pendente: true } as any).eq("id", cliente_id);
    if (profErr) {
      console.error("Erro ao marcar pagamento_pendente no profile", profErr);
    }

    // Simular envio de email ao cliente
    const { data: userData } = await admin.auth.admin.getUserById(cliente_id);
    const emailDestinatario = userData?.user?.email;
    console.log(`[EMAIL] Assunto: Cobrança requer ação. Link de pagamento: ${linkAvulso}. Enviado para: ${emailDestinatario || cliente_id}`);

    return json({
      ok: false,
      status: "failed",
      message: "CVV indisponível para cobrança silenciosa. Link de cobrança gerado e e-mail enviado (simulado).",
      link: linkAvulso
    });

  } catch (err: any) {
    console.error("Erro fatal", err);
    return json({ error: "INTERNAL", message: err?.message || "Erro interno." }, 500);
  }
});
