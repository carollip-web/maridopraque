// redeploy: 2026-05-29
// Impersonate user: gera magic link para super_admin entrar como qualquer conta de teste.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { preflight, ensureOrigin, jsonResponse, logAudit } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const originGuard = ensureOrigin(req);
  if (originGuard) return originGuard;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse(req, { error: "Não autenticado" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return jsonResponse(req, { error: "Não autenticado" }, 401);
    const { data: roles } = await userClient
      .from("user_roles")
      .select("role, admin_level")
      .eq("user_id", userData.user.id);
    const isSuperAdmin = (roles ?? []).some(
      (r: any) => r.role === "admin" && r.admin_level === "super_admin",
    );
    if (!isSuperAdmin) return jsonResponse(req, { error: "Apenas super_admin" }, 403);

    const { target_user_id, redirect_to } = await req.json();
    if (!target_user_id) return jsonResponse(req, { error: "target_user_id obrigatório" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    // Validar que alvo é conta de teste (segurança)
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("email, is_test")
      .eq("id", target_user_id)
      .maybeSingle();
    if (!targetProfile) return jsonResponse(req, { error: "Usuário não encontrado" }, 404);
    if (!targetProfile.is_test) {
      return jsonResponse(req, { error: "Apenas contas de teste podem ser impersonadas" }, 403);
    }

    // Gerar magic link
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetProfile.email!,
      options: { redirectTo: redirect_to ?? undefined },
    });
    if (linkErr) throw new Error(linkErr.message);

    await logAudit({
      actor_user_id: userData.user.id,
      action: "impersonate_user",
      target_user_id,
      details: { target_email: targetProfile.email },
    });

    return jsonResponse(req, {
      ok: true,
      action_link: link.properties?.action_link,
      email: targetProfile.email,
    });
  } catch (e: any) {
    console.error("impersonate-user error:", e?.message);
    return jsonResponse(req, { error: e?.message ?? "Erro interno" }, 500);
  }
});
