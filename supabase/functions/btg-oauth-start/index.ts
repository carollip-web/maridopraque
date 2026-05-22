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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // 1. Obter o usuário autenticado
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Valida que o usuário é admin com nível elevado (super_admin ou financeiro)
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("admin_level")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .in("admin_level", ["super_admin", "financeiro"])
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Acesso restrito a administradores com nível elevado." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Obter credenciais BTG das secrets
    const btgClientId = Deno.env.get("BTG_CLIENT_ID");
    if (!btgClientId) {
      throw new Error("BTG_CLIENT_ID não está configurado nas Secrets do Supabase.");
    }

    const redirectUri = Deno.env.get("BTG_REDIRECT_URI");
    if (!redirectUri) {
      throw new Error("BTG_REDIRECT_URI não está configurado nas Secrets do Supabase.");
    }

    // 4. Montar URL de autorização BTG
    const scopes =
      "openid empresas.btgpactual.com/accounts empresas.btgpactual.com/accounts.readonly brn:btg:empresas:banking:payments brn:btg:empresas:banking:payments.readonly brn:btg:empresas:credit-conciliation";

    // Gerar um state aleatório
    const state = crypto.randomUUID();

    // Gravar o state no banco de dados para validação no callback usando service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    // Salvar o state gerado no banco para o provider 'btg'
    const { error: upsertError } = await supabaseAdmin.from("marketplace_integracoes").upsert(
      {
        provider: "btg",
        connected_by: user.id,
        extra: { oauth_state: state },
      },
      { onConflict: "provider" },
    );

    if (upsertError) {
      throw new Error(
        `Falha ao registrar o estado da sessão de autenticação: ${upsertError.message}`,
      );
    }

    const authUrl = `https://id.sandbox.btgpactual.com/oauth2/authorize?client_id=${btgClientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}&prompt=login`;

    return new Response(JSON.stringify({ authUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
