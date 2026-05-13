// Manage Professionals: cria e exclui contas de profissionais.
// Apenas super_admin pode invocar.
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

    const {
      action,
      email,
      nome,
      password,
      user_id,
      target_role = "profissional",
    } = await req.json();
    const admin = createClient(supabaseUrl, serviceKey);

    if (action === "create") {
      if (!email || !nome || !password)
        return jsonResponse(req, { error: "Dados incompletos" }, 400);
      if (typeof password !== "string" || password.length < 8) {
        return jsonResponse(req, { error: "Senha deve ter no mínimo 8 caracteres" }, 400);
      }

      // Create user
      const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome },
      });
      if (createErr) return jsonResponse(req, { error: createErr.message }, 400);
      const userId = createRes.user.id;

      // Upsert profile
      await admin.from("profiles").upsert({
        id: userId,
        nome,
        email,
        is_test: false,
      });

      // Set role
      await admin.from("user_roles").insert({
        user_id: userId,
        role: target_role,
      });

      // If Profissional: criar perfil específico
      if (target_role === "profissional") {
        await admin.from("profissional_perfil").insert({
          user_id: userId,
          ativo: true,
          onboarding_completo: true,
          termo_aceito_em: new Date().toISOString(),
          termo_versao: "v1",
        });
      }

      await logAudit({
        actor_user_id: userData.user.id,
        action: "create_professional",
        target_user_id: userId,
        details: { email, nome, target_role },
      });

      return jsonResponse(req, { ok: true, user_id: userId });
    }

    if (action === "delete") {
      if (!user_id) return jsonResponse(req, { error: "user_id obrigatório" }, 400);

      const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
      if (delErr) return jsonResponse(req, { error: delErr.message }, 400);

      await logAudit({
        actor_user_id: userData.user.id,
        action: "delete_professional",
        target_user_id: user_id,
      });

      return jsonResponse(req, { ok: true });
    }

    return jsonResponse(req, { error: "Ação inválida" }, 400);
  } catch (e: any) {
    console.error("manage-professionals error:", e?.message);
    return jsonResponse(req, { error: e?.message ?? "Erro interno" }, 500);
  }
});
