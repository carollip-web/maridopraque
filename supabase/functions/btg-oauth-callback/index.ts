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
    const body = await req.json().catch(() => ({}));
    const code: string | undefined = body.code;
    const state: string | undefined = body.state;

    if (!code || !state) {
      return new Response(JSON.stringify({ error: "Parâmetros code e state são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const btgClientId = Deno.env.get("BTG_CLIENT_ID");
    const btgClientSecret = Deno.env.get("BTG_CLIENT_SECRET");
    const redirectUri = Deno.env.get("BTG_REDIRECT_URI");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    if (!btgClientId || !btgClientSecret || !redirectUri) {
      console.error("Variáveis de ambiente do BTG não configuradas.");
      return new Response(JSON.stringify({ error: "Configuração do BTG ausente no servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Inicializar cliente admin para verificar o state salvo
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    // Buscar o registro existente para validar o state
    const { data: integrationData, error: fetchError } = await supabaseAdmin
      .from("marketplace_integracoes")
      .select("connected_by, extra")
      .eq("provider", "btg")
      .maybeSingle();

    if (fetchError || !integrationData) {
      return new Response(
        JSON.stringify({ error: "Sessão de autenticação não encontrada ou expirada" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const savedState = integrationData.extra?.oauth_state;
    if (!savedState || savedState !== state) {
      return new Response(
        JSON.stringify({ error: "Estado de autenticação inválido (CSRF detectado)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("Exchanging BTG OAuth code for access token...");

    // 2. Base64 encode das credenciais para o Header de Autenticação Basic
    const credentialsBase64 = btoa(`${btgClientId}:${btgClientSecret}`);

    // 3. Trocar o authorization code pelos tokens de acesso do BTG
    const tokenResponse = await fetch("https://id.sandbox.btgpactual.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentialsBase64}`,
        accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error("Erro ao obter token do BTG:", errBody);
      return new Response(
        JSON.stringify({ error: `Erro no servidor do BTG ao obter token: ${errBody}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope, account_id, company_id } = tokenData;

    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

    console.log("Atualizando marketplace_integracoes com os novos tokens BTG...");

    // 4. Fazer UPSERT dos tokens na tabela de integrações
    const { error: dbError } = await supabaseAdmin.from("marketplace_integracoes").upsert(
      {
        provider: "btg",
        access_token,
        refresh_token,
        token_expires_at: expiresAt,
        scope,
        account_id: account_id || null,
        company_id: company_id || null,
        connected_at: new Date().toISOString(),
        connected_by: integrationData.connected_by,
        extra: {
          token_response: tokenData,
          oauth_state: null, // Limpar o state após o uso bem sucedido
        },
      },
      { onConflict: "provider" },
    );

    if (dbError) {
      console.error("Erro ao salvar tokens do BTG no banco:", dbError);
      return new Response(JSON.stringify({ error: "Falha ao salvar tokens no banco de dados" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, scope }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro não tratado no callback OAuth do BTG:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno no servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
