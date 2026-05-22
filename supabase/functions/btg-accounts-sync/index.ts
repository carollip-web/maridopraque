import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decodeJwtCompanyId(token: string): string | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(""),
    );
    const payload = JSON.parse(jsonPayload);

    // Procura na claim por qualquer permissão que possua o valor de um CNPJ (14 digitos)
    for (const key of Object.keys(payload)) {
      if (key.includes("empresas.btgpactual.com") || key.includes("brn:btg:empresas")) {
        const val = payload[key];
        if (typeof val === "string" && val.length === 14) {
          return val;
        }
      }
    }
  } catch (e) {
    console.error("Erro ao decodificar JWT", e);
  }
  // Sandbox default CNPJ de acordo com a documentação do BTG
  return null;
}

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

    // 1. Obter usuário autenticado
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

    // 2. Valida que o usuário é admin com nível elevado
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

    // Service role para contornar RLS ao atualizar e buscar integrações
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 3. Buscar credenciais BTG
    const { data: btgConfig, error: btgError } = await supabaseAdmin
      .from("marketplace_integracoes")
      .select("access_token, token_expires_at, scope, extra")
      .eq("provider", "btg")
      .maybeSingle();

    if (btgError || !btgConfig || !btgConfig.access_token) {
      return new Response(
        JSON.stringify({ error: "Integração BTG não encontrada ou não autenticada." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const tokenExpired = btgConfig.token_expires_at
      ? new Date(btgConfig.token_expires_at) <= new Date()
      : true;

    if (tokenExpired) {
      return new Response(
        JSON.stringify({ error: "Token BTG sem permissão para consultar contas ou expirado." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const companyId = decodeJwtCompanyId(btgConfig.access_token);
    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "Não foi possível identificar o companyId no token." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Consultar contas no BTG
    const endpoint = `https://api.sandbox.empresas.btgpactual.com/${companyId}/banking/accounts`;

    console.log("Chamando endpoint BTG Accounts:", {
      provider: "btg",
      companyId: companyId,
      endpoint: endpoint,
    });

    const btgResponse = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${btgConfig.access_token}`,
        "Content-Type": "application/json",
      },
    });

    const responseText = await btgResponse.text();
    let responseJson = null;
    try {
      if (responseText) responseJson = JSON.parse(responseText);
    } catch (e) {
      responseJson = { rawText: responseText };
    }

    console.log("BTG API call result:", {
      status: btgResponse.status,
      accountsFound: responseJson?.data?.length || 0,
      response: responseJson,
    });

    if (!btgResponse.ok) {
      if (btgResponse.status === 401 || btgResponse.status === 403) {
        return new Response(
          JSON.stringify({ error: "Token BTG sem permissão para consultar contas ou expirado." }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      return new Response(
        JSON.stringify({ error: "Erro ao consultar BTG.", details: responseJson }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const accounts = responseJson?.data || [];

    if (accounts.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma conta BTG encontrada para este token." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { account_id } = await req.json().catch(() => ({}));

    let selectedAccount = null;
    if (account_id) {
      selectedAccount = accounts.find(
        (a: any) => a.number === account_id || a.accountId === account_id,
      );
    } else if (accounts.length === 1) {
      selectedAccount = accounts[0];
    }

    let savedData = {};

    if (selectedAccount) {
      const updatePayload = {
        company_id: companyId,
        account_id: selectedAccount.number, // Salvando o número da conta como account_id conforme pedido na spec do debitParty
        extra: {
          ...((btgConfig.extra as any) || {}),
          accounts_raw: accounts,
          selected_account: selectedAccount,
        },
      };
      await supabaseAdmin
        .from("marketplace_integracoes")
        .update(updatePayload)
        .eq("provider", "btg");

      savedData = updatePayload;
    } else {
      // Se tiver mais de uma e não foi especificada
      await supabaseAdmin
        .from("marketplace_integracoes")
        .update({
          company_id: companyId,
          extra: { ...((btgConfig.extra as any) || {}), accounts_raw: accounts },
        })
        .eq("provider", "btg");
    }

    return new Response(
      JSON.stringify({
        success: true,
        companyId,
        accounts,
        selected: !!selectedAccount,
        savedData,
        requires_selection: !selectedAccount && accounts.length > 1,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    console.error("Erro fatal na edge function btg-accounts-sync:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
