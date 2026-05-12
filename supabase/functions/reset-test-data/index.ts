// Reset test data: apaga todos os usuários e pedidos marcados is_test=true.
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

    const admin = createClient(supabaseUrl, serviceKey);

    // Pegar IDs de usuários de teste
    const { data: testProfiles } = await admin.from("profiles").select("id").eq("is_test", true);
    const userIds = (testProfiles ?? []).map((p: any) => p.id);

    // Apagar pedidos de teste (e cascatas: materiais, mensagens, avaliações, recusas)
    const { data: pedTeste } = await admin.from("orcamentos").select("id").eq("is_test", true);
    const pedIds = (pedTeste ?? []).map((p: any) => p.id);
    if (pedIds.length) {
      await admin.from("orcamento_materiais").delete().in("orcamento_id", pedIds);
      await admin.from("mensagens").delete().in("orcamento_id", pedIds);
      await admin.from("avaliacoes").delete().in("orcamento_id", pedIds);
      await admin.from("orcamento_recusas").delete().in("orcamento_id", pedIds);
      await admin.from("notificacoes").delete().in("orcamento_id", pedIds);
      await admin.from("orcamentos").delete().in("id", pedIds);
    }

    // Apagar dados ligados aos usuários de teste
    if (userIds.length) {
      await admin.from("profissional_perfil").delete().in("user_id", userIds);
      await admin.from("profissional_disponibilidade").delete().in("user_id", userIds);
      await admin.from("profissional_bloqueios").delete().in("user_id", userIds);
      await admin.from("cliente_enderecos").delete().in("user_id", userIds);
      await admin.from("user_roles").delete().in("user_id", userIds);
      await admin.from("notificacoes").delete().in("user_id", userIds);
      await admin.from("profiles").delete().in("id", userIds);

      // Deletar do auth
      for (const id of userIds) {
        await admin.auth.admin.deleteUser(id).catch(() => {});
      }
    }

    return json({ ok: true, usuarios_removidos: userIds.length, pedidos_removidos: pedIds.length });
  } catch (e: any) {
    console.error("reset-test-data error:", e);
    return json({ error: e?.message ?? "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
