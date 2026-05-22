import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: btgData, error: dbErr } = await supabaseAdmin
      .from("marketplace_integracoes")
      .select("*")
      .eq("provider", "btg")
      .maybeSingle();

    if (dbErr || !btgData || !btgData.refresh_token) {
      console.log("[btg-token-refresh] Integração BTG não encontrada ou sem refresh_token.");
      return new Response(JSON.stringify({ ok: true, msg: "Nenhuma ação necessária" }), {
        status: 200,
      });
    }

    const expiresAt = btgData.token_expires_at ? new Date(btgData.token_expires_at).getTime() : 0;
    const now = Date.now();
    const thirtyMinutesInMs = 30 * 60 * 1000;

    // Se faltar mais de 30 minutos para expirar, não faz nada
    if (expiresAt > now + thirtyMinutesInMs) {
      console.log("[btg-token-refresh] Token ainda válido e distante do vencimento.");
      return new Response(JSON.stringify({ ok: true, msg: "Token válido" }), { status: 200 });
    }

    console.log("[btg-token-refresh] Token próximo do vencimento ou vencido. Atualizando...");

    const btgClientId = Deno.env.get("BTG_CLIENT_ID");
    const btgClientSecret = Deno.env.get("BTG_CLIENT_SECRET");

    if (!btgClientId || !btgClientSecret) {
      throw new Error("Credenciais BTG não configuradas (CLIENT_ID / CLIENT_SECRET)");
    }

    const credentialsBase64 = btoa(`${btgClientId}:${btgClientSecret}`);

    const tokenResponse = await fetch("https://id.sandbox.btgpactual.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentialsBase64}`,
        accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: btgData.refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error("[btg-token-refresh] Erro ao renovar token no BTG:", errBody);
      return new Response(JSON.stringify({ ok: false, error: errBody }), { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    const {
      access_token,
      refresh_token: new_refresh_token,
      expires_in,
      scope,
      account_id,
      company_id,
    } = tokenData;

    const newExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

    const { error: updateErr } = await supabaseAdmin
      .from("marketplace_integracoes")
      .update({
        access_token,
        refresh_token: new_refresh_token || btgData.refresh_token,
        token_expires_at: newExpiresAt,
        scope,
        account_id: account_id || btgData.account_id,
        company_id: company_id || btgData.company_id,
        extra: {
          ...btgData.extra,
          last_refresh: new Date().toISOString(),
        },
      })
      .eq("id", btgData.id);

    if (updateErr) {
      console.error("[btg-token-refresh] Erro ao atualizar DB:", updateErr);
      return new Response(JSON.stringify({ ok: false, error: updateErr.message }), { status: 500 });
    }

    console.log("[btg-token-refresh] Token atualizado com sucesso!");
    return new Response(JSON.stringify({ ok: true, msg: "Token atualizado" }), { status: 200 });
  } catch (error: any) {
    console.error("[btg-token-refresh] Erro fatal:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }
});
