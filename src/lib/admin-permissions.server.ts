// Server-only helpers para validação de permissões administrativas.
// NÃO importar em código de cliente. As checagens batem na tabela
// public.user_roles (role + admin_level) usando o supabase autenticado
// que vem do middleware requireSupabaseAuth.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminLevel = "super_admin" | "admin" | "financeiro" | "suporte";

export type AdminSection =
  | "dashboard"
  | "pedidos"
  | "profissionais"
  | "clientes"
  | "servicos"
  | "financeiro"
  | "config"
  | "equipe"
  | "modo_teste"
  | "auditoria";

// Espelha PERMISSIONS de src/hooks/useAuth.ts.
const PERMISSIONS: Record<AdminLevel, AdminSection[]> = {
  super_admin: [
    "dashboard",
    "pedidos",
    "profissionais",
    "clientes",
    "servicos",
    "financeiro",
    "config",
    "equipe",
    "modo_teste",
    "auditoria",
  ],
  admin: ["dashboard", "pedidos", "profissionais", "clientes", "servicos", "config"],
  financeiro: ["dashboard", "financeiro"],
  suporte: ["pedidos", "clientes"],
};

// Espelha READ_ONLY_SECTIONS de src/hooks/useAuth.ts.
const READ_ONLY_SECTIONS: Record<AdminLevel, AdminSection[]> = {
  super_admin: [],
  admin: [],
  financeiro: ["dashboard"],
  suporte: ["pedidos", "clientes"],
};

interface AdminContext {
  level: AdminLevel;
}

async function loadAdminLevel(
  supabase: SupabaseClient,
  userId: string,
): Promise<AdminLevel | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, admin_level")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) {
    console.error("[admin-permissions] erro ao ler user_roles:", error);
    throw new Error("Não foi possível validar suas permissões.");
  }
  if (!data) return null;
  // Fail-closed: admin sem admin_level NÃO recebe privilégios.
  const lvl = data.admin_level as AdminLevel | null;
  return lvl ?? null;
}

/**
 * Garante que o usuário é admin com algum admin_level válido.
 * Retorna o nível para checagens adicionais.
 */
export async function requireAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<AdminContext> {
  const level = await loadAdminLevel(supabase, userId);
  if (!level) throw new Error("Acesso restrito: requer permissão de administrador.");
  return { level };
}

/** Apenas super_admin. */
export async function requireSuperAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<AdminContext> {
  const ctx = await requireAdmin(supabase, userId);
  if (ctx.level !== "super_admin") {
    throw new Error("Acesso restrito: requer super administrador.");
  }
  return ctx;
}

/** Permite somente os níveis informados. */
export async function requireAdminLevel(
  supabase: SupabaseClient,
  userId: string,
  levels: AdminLevel[],
): Promise<AdminContext> {
  const ctx = await requireAdmin(supabase, userId);
  if (!levels.includes(ctx.level)) {
    throw new Error("Acesso restrito: seu nível administrativo não permite esta ação.");
  }
  return ctx;
}

/**
 * Garante que o admin pode ESCREVER (mutações) na seção indicada.
 * Bloqueia níveis sem acesso à seção e níveis com acesso somente-leitura.
 */
export async function requireWritableAdminSection(
  supabase: SupabaseClient,
  userId: string,
  section: AdminSection,
): Promise<AdminContext> {
  const ctx = await requireAdmin(supabase, userId);
  const allowed = PERMISSIONS[ctx.level] ?? [];
  if (!allowed.includes(section)) {
    throw new Error(`Acesso restrito: sem permissão para a seção "${section}".`);
  }
  const readOnly = READ_ONLY_SECTIONS[ctx.level] ?? [];
  if (readOnly.includes(section)) {
    throw new Error(`Acesso restrito: sua permissão em "${section}" é somente leitura.`);
  }
  return ctx;
}
