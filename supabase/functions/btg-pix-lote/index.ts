import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { repasse_id } = await req.json();
    if (!repasse_id) {
      throw new Error("repasse_id é obrigatório");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Auth client to verify user
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Não autorizado");

    // Admin validation
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("admin_level")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .in("admin_level", ["super_admin", "financeiro"])
      .maybeSingle();

    if (!roleData) throw new Error("Acesso restrito a administradores com nível elevado.");

    // Admin client to bypass RLS for processing
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch Repasse
    const { data: repasse, error: repasseErr } = await supabaseAdmin
      .from("repasses_profissionais")
      .select(
        "*, profissional_perfil:profissional_id(pix_key, pix_key_type, pix_holder_name, pix_holder_document)",
      )
      .eq("id", repasse_id)
      .single();

    if (repasseErr || !repasse) throw new Error("Repasse não encontrado");

    // 2. Fetch BTG Token
    const { data: btgToken, error: tokenErr } = await supabaseAdmin
      .from("marketplace_integracoes")
      .select("*")
      .eq("provider", "btg")
      .single();

    if (tokenErr || !btgToken || !btgToken.access_token) {
      throw new Error("Integração com BTG não encontrada ou não conectada");
    }

    let accessToken = btgToken.access_token;

    // 3. Auto-refresh Token if expired (buffer de 60s)
    const expiresAt = new Date(btgToken.token_expires_at || 0);
    if (expiresAt.getTime() - 60000 < Date.now()) {
      console.log("Token BTG expirado. Fazendo refresh...");
      const btgClientId = Deno.env.get("BTG_CLIENT_ID");
      const btgClientSecret = Deno.env.get("BTG_CLIENT_SECRET") || "";

      const refreshBody = new URLSearchParams();
      refreshBody.append("grant_type", "refresh_token");
      refreshBody.append("refresh_token", btgToken.refresh_token);
      refreshBody.append("client_id", btgClientId!);

      const btgAuthUrl = "https://id.sandbox.btgpactual.com/oauth2/token"; // sandbox por enquanto
      const basicAuth = btoa(`${btgClientId}:${btgClientSecret}`);

      const refreshRes = await fetch(btgAuthUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`,
        },
        body: refreshBody,
      });

      if (!refreshRes.ok) {
        throw new Error("Falha ao atualizar token do BTG");
      }

      const refreshData = await refreshRes.json();
      accessToken = refreshData.access_token;

      // Update in DB
      const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
      await supabaseAdmin
        .from("marketplace_integracoes")
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          token_expires_at: newExpiresAt,
        })
        .eq("id", btgToken.id);
    }

    // 4. Montar Payload BTG Pix
    const pixData = Array.isArray(repasse.profissional_perfil)
      ? repasse.profissional_perfil[0]
      : repasse.profissional_perfil;

    if (!pixData || !pixData.pix_key) {
      throw new Error("Profissional não possui chave Pix cadastrada");
    }

    const btgApiUrl = Deno.env.get("BTG_API_URL") || "https://api.sandbox.empresas.btgpactual.com";

    const idempotencyKey = crypto.randomUUID();
    const paymentPayload = {
      amount: repasse.valor_liquido,
      description: `Repasse Marketplace ${repasse.id}`,
      creditParty: {
        pixKey: pixData.pix_key,
        pixKeyType: pixData.pix_key_type,
        name: pixData.pix_holder_name,
        taxId: pixData.pix_holder_document,
      },
      callbackUrl: `${supabaseUrl}/functions/v1/btg-webhook`,
    };

    // 5. Chamar BTG API
    const pixRes = await fetch(`${btgApiUrl}/v1/pix/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(paymentPayload),
    });

    if (!pixRes.ok) {
      const errData = await pixRes.text();
      console.error("Erro BTG:", errData);
      throw new Error("Falha ao solicitar pagamento no BTG");
    }

    const pixResponseData = await pixRes.json();

    // 6. Atualizar Repasse para Processando
    await supabaseAdmin
      .from("repasses_profissionais")
      .update({
        status: "processando",
        processing_at: new Date().toISOString(),
        btg_transfer_id: pixResponseData.id || idempotencyKey,
        btg_request_payload: paymentPayload,
      })
      .eq("id", repasse.id);

    return new Response(JSON.stringify({ success: true, transfer_id: pixResponseData.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Erro no btg-pix-lote:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
