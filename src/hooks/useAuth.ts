import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Role = "cliente" | "profissional" | "admin";
export type AdminLevel = "super_admin" | "admin" | "financeiro" | "suporte" | null;

export type AdminSection =
  | "dashboard"
  | "pedidos"
  | "profissionais"
  | "clientes"
  | "servicos"
  | "financeiro"
  | "config"
  | "equipe"
  | "modo_teste";

// Permission matrix per admin level
const PERMISSIONS: Record<NonNullable<AdminLevel>, AdminSection[]> = {
  super_admin: ["dashboard", "pedidos", "profissionais", "clientes", "servicos", "financeiro", "config", "equipe", "modo_teste"],
  admin:       ["dashboard", "pedidos", "profissionais", "clientes", "servicos", "config"],
  financeiro:  ["dashboard", "financeiro"],
  suporte:     ["pedidos", "clientes"],
};

// Sections where a level has read-only access (no mutations)
export const READ_ONLY_SECTIONS: Record<NonNullable<AdminLevel>, AdminSection[]> = {
  super_admin: [],
  admin:       [],
  financeiro:  ["dashboard"],
  suporte:     ["pedidos", "clientes"],
};

interface UserProfile {
  id: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  roles: Role[];
  adminLevel: AdminLevel;
  loading: boolean;
  rolesLoaded: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    roles: [],
    adminLevel: null,
    loading: true,
    rolesLoaded: false,
  });

  useEffect(() => {
    let mounted = true;

    const loadProfile = async (userId: string) => {
      const [{ data: profile }, { data: roles, error: rolesError }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role, admin_level").eq("user_id", userId),
      ]);
      if (!mounted) return;
      if (rolesError) console.error("[useAuth] roles query error:", rolesError);

      let roleList = (roles ?? []).map((r) => r.role as Role);
      const adminRow = (roles ?? []).find((r) => r.role === "admin");
      // Fallback: if column doesn't exist yet (migration pending), treat admin as super_admin
      const rawLevel = adminRow?.admin_level ?? null;
      let adminLevel = (roleList.includes("admin") && !rawLevel ? "super_admin" : rawLevel) as AdminLevel;

      // EMERGÊNCIA: Bypass para Carol e Diego
      const userEmail = profile?.email || session?.user?.email;
      if (userEmail && ["carol.lip@gmail.com", "engenheirodonald@yahoo.com"].includes(userEmail.toLowerCase())) {
        console.log("[useAuth] EMERGENCY BYPASS TRIGGERED for", userEmail);
        if (!roleList.includes("admin")) roleList.push("admin");
        adminLevel = "super_admin";
      }

      console.log("[useAuth] userId:", userId, "email:", userEmail, "roles:", roleList, "adminLevel:", adminLevel);

      setState((s) => ({
        ...s,
        profile: profile
          ? { id: profile.id, nome: profile.nome, email: profile.email, whatsapp: profile.whatsapp }
          : null,
        roles: roleList,
        adminLevel,
        rolesLoaded: true,
      }));
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        loading: false,
        rolesLoaded: session?.user ? s.rolesLoaded : true,
      }));
      if (session?.user) {
        setTimeout(() => loadProfile(session.user.id), 0);
      } else {
        setState((s) => ({ ...s, profile: null, roles: [], adminLevel: null, rolesLoaded: true }));
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        loading: false,
        rolesLoaded: session?.user ? s.rolesLoaded : true,
      }));
      if (session?.user) loadProfile(session.user.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isReady = !state.loading && (state.user ? state.rolesLoaded : true);
  const isAdmin = state.roles.includes("admin");
  const isSuperAdmin = state.adminLevel === "super_admin";
  const adminLevel = state.adminLevel;

  const canAccess = (section: AdminSection): boolean => {
    if (!isAdmin || !adminLevel) return false;
    return PERMISSIONS[adminLevel]?.includes(section) ?? false;
  };

  const isReadOnly = (section: AdminSection): boolean => {
    if (!isAdmin || !adminLevel) return true;
    return READ_ONLY_SECTIONS[adminLevel]?.includes(section) ?? false;
  };

  const allowedTabs = isAdmin && adminLevel ? PERMISSIONS[adminLevel] : [];

  return {
    ...state,
    loading: !isReady,
    isLoggedIn: !!state.session,
    isProfissional: state.roles.includes("profissional"),
    isAdmin,
    isSuperAdmin,
    adminLevel,
    canAccess,
    isReadOnly,
    allowedTabs,
    // legacy compatibility
    profilePhoto: null as string | null,
    userData: {
      name: state.profile?.nome ?? "",
      whatsapp: state.profile?.whatsapp ?? "",
      birthDate: "",
      email: state.profile?.email ?? state.user?.email ?? "",
    },
    login: () => {},
    logout: async () => { await supabase.auth.signOut(); },
    updatePhoto: (_: string) => {},
    updateUserData: (_: any) => {},
  };
}
