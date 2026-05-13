// Seed test data: cria 1 admin, 3 profissionais, 5 clientes e pedidos cobrindo todos os status.
// Apenas super_admin pode invocar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEST_PASSWORD = "Teste@2026!";
const TEST_EMAIL_DOMAIN = "teste.maridopraque.local";

type SeedUser = {
  email: string;
  nome: string;
  whatsapp: string;
  role: "cliente" | "profissional" | "admin";
  adminLevel?: "super_admin" | "admin" | "financeiro" | "suporte";
};

const USERS: SeedUser[] = [
  { email: `admin-teste@${TEST_EMAIL_DOMAIN}`, nome: "Admin Teste", whatsapp: "11999990001", role: "admin", adminLevel: "admin" },
  { email: `pro1@${TEST_EMAIL_DOMAIN}`, nome: "Pedro Profissional", whatsapp: "11999990010", role: "profissional" },
  { email: `pro2@${TEST_EMAIL_DOMAIN}`, nome: "Paulo Profissional", whatsapp: "11999990011", role: "profissional" },
  { email: `pro3@${TEST_EMAIL_DOMAIN}`, nome: "Pamela Profissional", whatsapp: "11999990012", role: "profissional" },
  { email: `cli1@${TEST_EMAIL_DOMAIN}`, nome: "Carla Cliente", whatsapp: "11999990020", role: "cliente" },
  { email: `cli2@${TEST_EMAIL_DOMAIN}`, nome: "Caio Cliente", whatsapp: "11999990021", role: "cliente" },
  { email: `cli3@${TEST_EMAIL_DOMAIN}`, nome: "Camila Cliente", whatsapp: "11999990022", role: "cliente" },
  { email: `cli4@${TEST_EMAIL_DOMAIN}`, nome: "Cesar Cliente", whatsapp: "11999990023", role: "cliente" },
  { email: `cli5@${TEST_EMAIL_DOMAIN}`, nome: "Cintia Cliente", whatsapp: "11999990024", role: "cliente" },
];

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

    const admin = createClient(supabaseUrl, serviceKey);
    const created: { email: string; user_id: string; role: string }[] = [];

    // Create / update users
    for (const u of USERS) {
      // Try create; if exists, fetch
      const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
        email: u.email,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { nome: u.nome },
      });
      let userId = createRes?.user?.id;
      if (createErr && !userId) {
        // Find existing user
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const existing = list.users.find((x) => x.email === u.email);
        if (!existing) throw new Error(`Falha ao criar/encontrar ${u.email}: ${createErr.message}`);
        userId = existing.id;
        // Reset password
        await admin.auth.admin.updateUserById(userId, { password: TEST_PASSWORD });
      }
      if (!userId) continue;

      // Upsert profile (handle_new_user trigger may already have created it)
      await admin.from("profiles").upsert({
        id: userId, nome: u.nome, email: u.email, whatsapp: u.whatsapp, is_test: true,
      });

      // Set role
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({
        user_id: userId, role: u.role, admin_level: u.adminLevel ?? null,
      });

      // Profissional: criar perfil
      if (u.role === "profissional") {
        await admin.from("profissional_perfil").upsert({
          user_id: userId,
          slug: u.email.split("@")[0],
          bio: `Profissional de teste — ${u.nome}`,
          especialidades: ["Hidráulica", "Elétrica", "Pintura"],
          cidade: "São Paulo",
          ativo: true,
          onboarding_completo: true,
          termo_aceito_em: new Date().toISOString(),
          termo_versao: "v1",
        });
      }

      created.push({ email: u.email, user_id: userId, role: u.role });
    }

    // Pegar serviços do catálogo (qualquer)
    const { data: services } = await admin.from("services_catalog").select("id, nome").eq("ativo", true).limit(5);
    const svc = services?.[0];

    const clientes = created.filter((c) => c.role === "cliente");
    const profs = created.filter((c) => c.role === "profissional");

    let pedidosCriados = 0;
    if (svc && clientes.length && profs.length) {
      const statuses = [
        { status: "customizado_pendente", profissional_id: null as string | null, valor: null as number | null },
        { status: "enviado",              profissional_id: profs[0].user_id, valor: 250 },
        { status: "aprovado",             profissional_id: profs[0].user_id, valor: 300 },
        { status: "agendado",             profissional_id: profs[1].user_id, valor: 350 },
        { status: "pago",                 profissional_id: profs[1].user_id, valor: 400 },
        { status: "concluido",            profissional_id: profs[2].user_id, valor: 450 },
      ];
      for (let i = 0; i < statuses.length; i++) {
        const s = statuses[i];
        const cli = clientes[i % clientes.length];
        await admin.from("orcamentos").insert({
          cliente_id: cli.user_id,
          profissional_id: s.profissional_id,
          service_id: svc.id,
          service_name: svc.nome,
          descricao: `[TESTE] Pedido em status ${s.status}`,
          status: s.status,
          valor: s.valor,
          valor_servico: s.valor,
          fotos_problema: [],
          is_test: true,
          data_aprovacao: ["aprovado", "agendado", "pago", "concluido"].includes(s.status) ? new Date().toISOString() : null,
          data_pagamento: ["pago", "concluido"].includes(s.status) ? new Date().toISOString() : null,
          data_agendada: ["agendado", "pago", "concluido"].includes(s.status) ? new Date(Date.now() + 86400000).toISOString() : null,
        });
        pedidosCriados++;
      }
    }

    // 5. Cleanup: Reassign budgets where a pro is mistakenly the client
    const { data: allProRoles } = await admin.from("user_roles").select("user_id").eq("role", "profissional");
    const allProIds = (allProRoles || []).map(p => p.user_id);
    if (allProIds.length > 0 && clientes.length > 0) {
      const targetClientId = clientes[0].user_id;
      const { error: errFix } = await admin
        .from("orcamentos")
        .update({ cliente_id: targetClientId })
        .in("cliente_id", allProIds);
      if (errFix) console.error("Error reassigning pro budgets:", errFix);
    }

    return json({
      ok: true,
      contas: created,
      pedidos_criados: pedidosCriados,
    });
  } catch (e: any) {
    console.error("seed-test-data error:", e);
    return json({ error: e?.message ?? "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
