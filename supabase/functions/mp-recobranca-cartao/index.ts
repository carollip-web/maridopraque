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

  const fetchWithRetry = async (url: string, init: RequestInit): Promise<Response> => {
    const delays = [800, 1600, 2400];
    let lastRes: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(url, init);
      if (res.status < 500) return res;
      lastRes = res;
      if (attempt < 3) await new Promise((r) => setTimeout(r, delays[attempt]));
    }
    return lastRes!;
  };

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

    const { mp_card_id, mp_customer_id, valor_total, cliente_id } = pagamento;
    const paymentMethodId = pagamento.metadata?.mp_auth_response?.payment_method_id;
    const issuerId = pagamento.metadata?.mp_auth_response?.issuer_id;
    
    // 2. Incrementar tentativas_cobranca e atualizar ultima_tentativa_em
    const novasTentativas = (pagamento.tentativas_cobranca || 0) + 1;
    const now = new Date().toISOString();

    await admin.from("pagamentos").update({
      tentativas_cobranca: novasTentativas,
      ultima_tentativa_em: now
    } as any).eq("id", pagamento.id);

    // 3. Gerar token de uso único a partir do cartão salvo
    const cardTokenRes = await fetchWithRetry(`https://api.mercadopago.com/v1/customers/${mp_customer_id}/cards/${mp_card_id}/tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const cardTokenData = await cardTokenRes.json().catch(() => ({}));
    if (!cardTokenRes.ok || !cardTokenData.id) {
      console.error("Erro gerando token do cartão salvo (recobrança)", cardTokenData);
      await admin.from("pagamentos").update({
        metadata: { ...pagamento.metadata, last_retry_error: cardTokenData }
      } as any).eq("id", pagamento.id);
      return json({ error: "MP_CARD_TOKEN_ERROR", message: "Erro ao gerar token do cartão salvo.", detail: cardTokenData }, 500);
    }
    const singleUseToken = cardTokenData.id;

    // 4. Criar novo pagamento (capture: true) usando token de uso único
    const paymentPayload = {
      transaction_amount: Number(valor_total),
      capture: true,
      description: "Recobrança Serviço Marido pra Que",
      installments: 1,
      payer: {
        type: "customer",
        id: mp_customer_id
      },
      token: singleUseToken,
      payment_method_id: paymentMethodId,
      issuer_id: issuerId,
      external_reference: orcamento_id,
      statement_descriptor: "MARIDO PRA QUE"
    };

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${pagamento.id}-retry-${novasTentativas}`
      },
      body: JSON.stringify(paymentPayload),
    });

    const mpBody = await mpRes.json().catch(() => ({}));

    // 4. Se sucesso
    if (mpRes.ok && (mpBody.status === "approved" || mpBody.status === "authorized")) {
      await admin.from("pagamentos").update({
        status_autorizacao: "capturado",
        capturado_em: now,
        status: "paid"
      } as any).eq("id", pagamento.id);
      
      await admin.from("orcamentos").update({ status: "pago", data_pagamento: now } as any).eq("id", orcamento_id);

      return json({ ok: true, status: "captured", payment: mpBody });
    } else {
      // 5 e 6. Se falha
      console.error("Falha na recobrança", mpBody);
      
      if (novasTentativas >= 2) {
        // Gerar link de pagamento avulso (Checkout Pro)
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

        // Atualizar status_autorizacao para 'falhou'
        const newMetadata = {
          ...pagamento.metadata,
          link_pagamento_avulso: linkAvulso,
          last_retry_error: mpBody
        };

        await admin.from("pagamentos").update({
          status_autorizacao: "falhou",
          metadata: newMetadata
        } as any).eq("id", pagamento.id);

        // Marcar conta do cliente com pagamento_pendente = true
        // Tentamos atualizar na tabela profiles; se a coluna não existir ainda precisará ser adicionada depois
        const { error: profErr } = await admin.from("profiles").update({ pagamento_pendente: true } as any).eq("id", cliente_id);
        if (profErr) {
          console.error("Erro ao marcar pagamento_pendente no profile", profErr);
        }

        // Simular envio de email ao cliente
        const { data: userData } = await admin.auth.admin.getUserById(cliente_id);
        const emailDestinatario = userData?.user?.email;
        console.log(`[EMAIL] Assunto: Cobrança falhou. Link de pagamento: ${linkAvulso}. Enviado para: ${emailDestinatario || cliente_id}`);

        return json({ 
          ok: false, 
          status: "failed", 
          message: "Tentativas esgotadas. Link de cobrança gerado e e-mail enviado (simulado).", 
          link: linkAvulso 
        });
      } else {
        // Tentativas < 2: agendar nova tentativa
        await admin.from("pagamentos").update({
          status_autorizacao: "recobranca_pendente",
          metadata: { ...pagamento.metadata, last_retry_error: mpBody }
        } as any).eq("id", pagamento.id);

        return json({ ok: false, status: "scheduled", message: "Pagamento falhou. Nova tentativa será agendada (status: recobranca_pendente)." });
      }
    }

  } catch (err: any) {
    console.error("Erro fatal", err);
    return json({ error: "INTERNAL", message: err?.message || "Erro interno." }, 500);
  }
});
