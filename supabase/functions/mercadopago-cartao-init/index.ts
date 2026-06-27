// Returns the seller's MP public_key + checkout amount for Payment Brick render.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calcularValores } from "../_shared/fees.ts";

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
    if (!orcamentoId)
      return json({ error: "BAD_REQUEST", message: "orcamentoId obrigatório." }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: orcamento } = await admin
      .from("orcamentos")
      .select(
        "id, cliente_id, profissional_id, status, valor, valor_servico, tipo_atendimento, service_name",
      )
      .eq("id", orcamentoId)
      .maybeSingle();
    if (!orcamento) return json({ error: "NOT_FOUND" }, 404);
    if (orcamento.cliente_id !== user.id) return json({ error: "FORBIDDEN" }, 403);
    if (orcamento.status !== "aprovado" && orcamento.status !== "aguardando_pagamento")
      return json(
        { error: "INVALID_STATUS", message: `Pedido em "${orcamento.status}" não está liberado.` },
        400,
      );

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
    const { valorTotal } = calcularValores(valorBase, requiresApoio);

    const { data: perfil } = await admin
      .from("profissional_perfil")
      .select("mp_public_key, mp_access_token, mp_expires_at")
      .eq("user_id", orcamento.profissional_id)
      .maybeSingle();

    if (!perfil?.mp_public_key || !perfil?.mp_access_token) {
      return json(
        { error: "MP_NOT_CONNECTED", message: "Profissional ainda não conectou o Mercado Pago." },
        400,
      );
    }
    if (perfil.mp_expires_at && new Date(perfil.mp_expires_at) < new Date()) {
      return json(
        {
          error: "MP_TOKEN_EXPIRED",
          message: "Token do profissional expirou. Peça para reconectar.",
        },
        400,
      );
    }

    return json({
      ok: true,
      publicKey: perfil.mp_public_key,
      amount: valorTotal,
      payerEmail: user.email,
      description: orcamento.service_name || "Serviço Marido pra Que",
    });
  } catch (err: any) {
    console.error("[mercadopago-cartao-init] erro", err);
    return json({ error: "INTERNAL", message: err?.message || "Erro interno." }, 500);
  }
});
