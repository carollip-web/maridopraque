// Manage Professionals: cria e exclui contas de profissionais.
// Apenas super_admin pode invocar.
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

    // Validate caller is super_admin
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
      (r: any) => r.role === "admin" && (r.admin_level === "super_admin" || r.admin_level === null),
    );
    if (!isSuperAdmin) return json({ error: "Apenas super_admin" }, 403);

    const { action, email, nome, password, user_id, target_role = "profissional" } = await req.json();
    const admin = createClient(supabaseUrl, serviceKey);

    if (action === "create") {
      if (!email || !nome || !password) return json({ error: "Dados incompletos" }, 400);

      // Create user
      const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome },
      });
      if (createErr) return json({ error: createErr.message }, 400);
      const userId = createRes.user.id;

      // Upsert profile
      await admin.from("profiles").upsert({
        id: userId, nome, email, is_test: false,
      });

      // Set role
      await admin.from("user_roles").insert({
        user_id: userId, role: target_role,
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

      return json({ ok: true, user_id: userId });
    }

    if (action === "delete") {
      if (!user_id) return json({ error: "user_id obrigatório" }, 400);

      // We don't need to delete from profiles/user_roles manually if FKs are set to CASCADE
      // but deleting from Auth is the main thing.
      const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
      if (delErr) return json({ error: delErr.message }, 400);

      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e: any) {
    console.error("manage-professionals error:", e);
    return json({ error: e?.message ?? "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
