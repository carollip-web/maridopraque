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
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

    if (!MP_ACCESS_TOKEN) {
      return json({ error: "CONFIG_ERROR", message: "MP_ACCESS_TOKEN não configurado." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "UNAUTHORIZED" }, 401);

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) return json({ error: "UNAUTHORIZED" }, 401);

    const body = await req.json().catch(() => ({}));
    const { orcamento_id, ator } = body;

    if (!orcamento_id || !ator || !["profissional", "cliente"].includes(ator)) {
      return json({ error: "BAD_REQUEST", message: "Parâmetros orcamento_id ou ator inválidos." }, 400);
    }

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
      return json({ error: "NOT_FOUND", message: "Nenhum pagamento encontrado para este orçamento." }, 404);
    }

    if (pagamento.status_autorizacao === "capturado") {
      return json({ error: "ALREADY_CAPTURED", message: "Pagamento já foi capturado." }, 400);
    }

    // Cruzar identidade do usuário autenticado com o ator declarado
    const userId = userData.user.id;
    if (ator === "cliente" && userId !== pagamento.cliente_id) {
      return json({ error: "FORBIDDEN", message: "Usuário não é o cliente deste pagamento." }, 403);
    }
    if (ator === "profissional" && userId !== pagamento.profissional_id) {
      return json({ error: "FORBIDDEN", message: "Usuário não é o profissional deste pagamento." }, 403);
    }

    const now = new Date().toISOString();
    const isProfissional = ator === "profissional";

    const confProfissional = isProfissional ? now : pagamento.confirmacao_profissional_em;
    const confCliente = !isProfissional ? now : pagamento.confirmacao_cliente_em;

    // 2. Atualizar a data de confirmação do ator
    const updatePayload: any = {};
    if (isProfissional) updatePayload.confirmacao_profissional_em = now;
    else updatePayload.confirmacao_cliente_em = now;

    await admin.from("pagamentos").update(updatePayload).eq("id", pagamento.id);

    // 3. Verificar se AMBAS as confirmações existem
    const ambasConfirmadas = confProfissional && confCliente;

    if (!ambasConfirmadas) {
      // 5. Se não: retornar status parcial
      return json({
        ok: true,
        status: "partial",
        message: `Confirmação de ${ator} registrada. Aguardando a outra parte.`,
        confirmacao_profissional_em: confProfissional,
        confirmacao_cliente_em: confCliente
      });
    }

    // 4. Se sim:
    // a. Chamar PUT https://api.mercadopago.com/v1/payments/{payment_id}
    const mpPaymentId = pagamento.gateway_payment_id;
    if (!mpPaymentId) {
      return json({ error: "INVALID_STATE", message: "gateway_payment_id ausente." }, 500);
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ capture: true }),
    });

    const mpBody = await mpRes.json().catch(() => ({}));

    if (mpRes.ok && (mpBody.status === "approved" || mpBody.status === "authorized")) {
      // b. Se sucesso
      await admin
        .from("pagamentos")
        .update({
          status_autorizacao: "capturado",
          capturado_em: now,
          status: "paid"
        } as any)
        .eq("id", pagamento.id);
        
      await admin.from("orcamentos").update({ status: "pago", data_pagamento: now } as any).eq("id", orcamento_id);

      return json({
        ok: true,
        status: "captured",
        message: "Pagamento capturado com sucesso.",
        payment: mpBody
      });
    } else {
      // c. Se falha
      console.error("Falha ao capturar pagamento", mpBody);
      
      await admin
        .from("pagamentos")
        .update({
          status_autorizacao: "falhou"
        } as any)
        .eq("id", pagamento.id);

      // Chamar internamente mp-recobranca-cartao
      try {
        const { error: invokeErr } = await admin.functions.invoke('mp-recobranca-cartao', {
          body: { orcamento_id: orcamento_id }
        });
        if (invokeErr) {
          console.error("Erro ao invocar mp-recobranca-cartao", invokeErr);
        }
      } catch (err) {
        console.error("Exceção ao invocar mp-recobranca-cartao", err);
      }

      return json({
        ok: false,
        error: "CAPTURE_FAILED",
        message: "A captura falhou e a recobranca foi acionada.",
        detail: mpBody
      }, 400);
    }
  } catch (err: any) {
    console.error("Erro fatal", err);
    return json({ error: "INTERNAL", message: err?.message || "Erro interno." }, 500);
  }
});
