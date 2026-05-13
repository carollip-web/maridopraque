// Impersonate user: gera magic link para super_admin entrar como qualquer conta de teste.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Não autenticado" }, 401);
    const { data: roles } = await userClient
      .from("user_roles").select("role, admin_level").eq("user_id", userData.user.id);
    const isSuperAdmin = (roles ?? []).some(
      (r: any) => r.role === "admin" && r.admin_level === "super_admin",
    );
    if (!isSuperAdmin) return json({ error: "Apenas super_admin" }, 403);

    const { target_user_id, redirect_to } = await req.json();
    if (!target_user_id) return json({ error: "target_user_id obrigatório" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    // Validar que alvo é conta de teste (segurança)
    const { data: targetProfile } = await admin
      .from("profiles").select("email, is_test").eq("id", target_user_id).maybeSingle();
    if (!targetProfile) return json({ error: "Usuário não encontrado" }, 404);
    if (!targetProfile.is_test) {
      return json({ error: "Apenas contas de teste podem ser impersonadas" }, 403);
    }

    // Gerar magic link
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetProfile.email!,
      options: { redirectTo: redirect_to ?? undefined },
    });
    if (linkErr) throw new Error(linkErr.message);

    return json({ ok: true, action_link: link.properties?.action_link, email: targetProfile.email });
  } catch (e: any) {
    console.error("impersonate-user error:", e);
    return json({ error: e?.message ?? "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
