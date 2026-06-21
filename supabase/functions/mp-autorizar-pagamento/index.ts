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
    const MP_ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") ?? Deno.env.get("MP_ACCESS_TOKEN");

    if (!MP_ACCESS_TOKEN) {
      return json({ error: "CONFIG_ERROR", message: "Token do Mercado Pago não configurado." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "UNAUTHORIZED" }, 401);

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) return json({ error: "UNAUTHORIZED" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const { orcamento_id, card_token } = body;

    if (!orcamento_id || !card_token) {
      return json({ error: "BAD_REQUEST", message: "Faltando orcamento_id ou card_token." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Buscar orçamento
    const { data: orcamento, error: orcErr } = await admin
      .from("orcamentos")
      .select("id, cliente_id, profissional_id, status, valor, valor_servico, service_name, tipo_atendimento")
      .eq("id", orcamento_id)
      .maybeSingle();

    if (orcErr || !orcamento) return json({ error: "NOT_FOUND", message: "Orçamento não encontrado." }, 404);
    if (orcamento.cliente_id !== user.id) return json({ error: "FORBIDDEN", message: "Orçamento não pertence ao usuário." }, 403);

    // Calcula valor total (com ou sem materiais/apoio - base minimal)
    const { data: materiais } = await admin.from("orcamento_materiais").select("preco_unitario, quantidade").eq("orcamento_id", orcamento.id);
    const valorMateriais = (materiais || []).reduce((acc: number, m: any) => acc + Number(m.preco_unitario || 0) * Number(m.quantidade || 0), 0);
    const valorBase = Number(orcamento.valor_servico || orcamento.valor || 0) + valorMateriais;
    const requiresApoio = orcamento.tipo_atendimento === "homem_com_apoio_feminino";
    const valorApoio = requiresApoio ? Math.round(valorBase * 0.3 * 100) / 100 : 0;
    const valorTotal = Math.round((valorBase + valorApoio) * 100) / 100;

    // Cancela pagamentos pendentes
    await admin.from("pagamentos").update({ status: "canceled" } as any).eq("orcamento_id", orcamento.id).eq("status", "pending");

    // 2. Criar pagamento com capture: false usando o card_token fresco do Brick
    const paymentPayload = {
      transaction_amount: valorTotal,
      capture: false, // APENAS AUTORIZAÇÃO
      description: orcamento.service_name || "Serviço Marido pra Que",
      installments: 1,
      payer: { email: user.email },
      token: card_token,
      external_reference: orcamento.id,
      statement_descriptor: "MARIDO PRA QUE"
    };

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentPayload),
    });
    const mpBody = await mpRes.json();

    if (!mpRes.ok || (mpBody.status !== "authorized" && mpBody.status !== "pending" && mpBody.status !== "approved" && mpBody.status !== "in_process")) {
      console.error("Erro autorizando pagamento", mpBody);
      return json({ error: "MP_PAYMENT_ERROR", message: "Falha na autorização do pagamento.", detail: mpBody }, 400);
    }

    const mpPaymentId = String(mpBody.id);
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 7); // autorizacao_expira_em: now() + 7 days

    // 5. Salvar na tabela pagamentos
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
        gateway_payment_id: mpPaymentId,
        status_autorizacao: "autorizado",
        autorizacao_expira_em: expDate.toISOString(),
        metadata: {
          checkout_type: "auth_only",
          mp_auth_response: mpBody
        }
      } as any)
      .select("id")
      .single();

    if (pagErr) {
      console.error("Erro DB pagamentos", pagErr);
      return json({ error: "DB_ERROR", message: "Erro ao salvar autorização no banco." }, 500);
    }

    // 6. Retornar sucesso
    return json({
      ok: true,
      pagamento_id: pagamento.id,
      payment_id: mpPaymentId,
      status: mpBody.status,
    });

  } catch (err: any) {
    console.error("Erro fatal", err);
    return json({ error: "INTERNAL", message: err?.message || "Erro interno." }, 500);
  }
});
