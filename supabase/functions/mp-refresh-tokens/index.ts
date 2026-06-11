import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const MP_CLIENT_ID = Deno.env.get("MERCADO_PAGO_CLIENT_ID");
  const MP_CLIENT_SECRET = Deno.env.get("MERCADO_PAGO_CLIENT_SECRET");

  if (!MP_CLIENT_ID || !MP_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: "Missing MP client credentials" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const limite = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: perfis, error: queryError } = await supabase
    .from("profissional_perfil")
    .select("user_id, mp_refresh_token, mp_expires_at")
    .not("mp_refresh_token", "is", null)
    .lt("mp_expires_at", limite);

  if (queryError) {
    console.error("Erro ao buscar perfis:", queryError.message);
    return new Response(JSON.stringify({ error: queryError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let renovados = 0;
  let falhas = 0;

  for (const perfil of perfis ?? []) {
    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: MP_CLIENT_ID,
        client_secret: MP_CLIENT_SECRET,
        refresh_token: perfil.mp_refresh_token as string,
      });

      const resp = await fetch("https://api.mercadopago.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.error(
          `Falha refresh user_id=${perfil.user_id} status=${resp.status} body=${txt}`,
        );
        falhas++;
        continue;
      }

      const json = await resp.json();
      const newAccess = json.access_token as string | undefined;
      const newRefresh = json.refresh_token as string | undefined;
      const expiresIn = Number(json.expires_in);

      if (!newAccess || !newRefresh || !Number.isFinite(expiresIn)) {
        console.error(
          `Resposta inválida do MP para user_id=${perfil.user_id}`,
        );
        falhas++;
        continue;
      }

      const newExpiresAt = new Date(
        Date.now() + expiresIn * 1000,
      ).toISOString();

      const { error: updErr } = await supabase
        .from("profissional_perfil")
        .update({
          mp_access_token: newAccess,
          mp_refresh_token: newRefresh,
          mp_expires_at: newExpiresAt,
        })
        .eq("user_id", perfil.user_id);

      if (updErr) {
        console.error(
          `Erro ao atualizar user_id=${perfil.user_id}: ${updErr.message}`,
        );
        falhas++;
        continue;
      }

      renovados++;
    } catch (e) {
      console.error(
        `Exceção ao renovar user_id=${perfil.user_id}: ${(e as Error).message}`,
      );
      falhas++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, renovados, falhas }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
