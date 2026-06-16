import { useState, useEffect, useRef, useCallback } from "react";
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
  | "notificacoes"
  | "leads"
  | "apoio_feminino"
  | "kpis"
  | "disputas"
  | "suporte"
  | "dados";

/**
 * Permissions are NOT defined in the client anymore.
 * The single source of truth is the SECURITY DEFINER function
 * `public.get_admin_permissions()` in Postgres. The client only displays
 * what the server says it can; every mutation is re-validated server-side
 * via RLS / has_role / requireWritableAdminSection.
 */

interface UserProfile {
  id: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  avatar_url: string | null;
}

interface AdminPermissions {
  level: AdminLevel;
  allowed: AdminSection[];
  readOnly: AdminSection[];
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  roles: Role[];
  permissions: AdminPermissions;
  loading: boolean;
  rolesLoaded: boolean;
}

const EMPTY_PERMS: AdminPermissions = { level: null, allowed: [], readOnly: [] };

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    roles: [],
    permissions: EMPTY_PERMS,
    loading: true,
    rolesLoaded: false,
  });

  // Dedupe loadProfile calls (race between onAuthStateChange + getSession)
  const loadingForUserRef = useRef<string | null>(null);
  const lastLoadedUserRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async (userId: string) => {
      // Already loading or loaded for this user — skip duplicate
      if (loadingForUserRef.current === userId) return;
      if (lastLoadedUserRef.current === userId) return;
      loadingForUserRef.current = userId;

      try {
        const [{ data: profile }, { data: roles, error: rolesError }, { data: permsData }] =
          await Promise.all([
            supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", userId),
            supabase.rpc("get_admin_permissions", { _user_id: userId }),
          ]);
        if (!mounted) return;
        if (rolesError) console.error("[useAuth] roles query error:", rolesError);

        const roleList = (roles ?? []).map((r) => r.role as Role);

        const permsRaw = (permsData ?? {}) as {
          level?: string | null;
          allowed?: string[];
          read_only?: string[];
        };
        const permissions: AdminPermissions = {
          level: (permsRaw.level ?? null) as AdminLevel,
          allowed: (permsRaw.allowed ?? []) as AdminSection[],
          readOnly: (permsRaw.read_only ?? []) as AdminSection[],
        };

        lastLoadedUserRef.current = userId;

        setState((s) => ({
          ...s,
          profile: profile
            ? {
                id: profile.id,
                nome: profile.nome,
                email: profile.email,
                whatsapp: profile.whatsapp,
                avatar_url: profile.avatar_url,
              }
            : null,
          roles: roleList,
          permissions,
          rolesLoaded: true,
        }));
      } finally {
        if (loadingForUserRef.current === userId) loadingForUserRef.current = null;
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id ?? null;
      // Reset memoization when identity changes
      if (lastLoadedUserRef.current && lastLoadedUserRef.current !== uid) {
        lastLoadedUserRef.current = null;
      }
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        loading: false,
        rolesLoaded: uid ? s.rolesLoaded : true,
      }));
      if (uid) {
        setTimeout(() => loadProfile(uid), 0);
      } else {
        setState((s) => ({
          ...s,
          profile: null,
          roles: [],
          permissions: EMPTY_PERMS,
          rolesLoaded: true,
        }));
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        loading: false,
        rolesLoaded: uid ? s.rolesLoaded : true,
      }));
      if (uid) loadProfile(uid);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isReady = !state.loading && (state.user ? state.rolesLoaded : true);
  const isAdmin = state.roles.includes("admin");
  const adminLevel = state.permissions.level;
  const isSuperAdmin = adminLevel === "super_admin";

  const canAccess = useCallback(
    (section: AdminSection): boolean => state.permissions.allowed.includes(section),
    [state.permissions.allowed],
  );

  const isReadOnly = useCallback(
    (section: AdminSection): boolean => {
      if (!isAdmin || !adminLevel) return true;
      return state.permissions.readOnly.includes(section);
    },
    [isAdmin, adminLevel, state.permissions.readOnly],
  );

  const allowedTabs = state.permissions.allowed;

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
    profilePhoto: state.profile?.avatar_url ?? null,
    userData: {
      name: state.profile?.nome ?? "",
      whatsapp: state.profile?.whatsapp ?? "",
      birthDate: "",
      email: state.profile?.email ?? state.user?.email ?? "",
    },
    login: () => {},
    logout: async () => {
      await supabase.auth.signOut();
    },
    updatePhoto: async (base64String: string) => {
      if (!state.user) return;
      try {
        const fetchResponse = await fetch(base64String);
        const blob = await fetchResponse.blob();

        const ext = blob.type.split("/")[1] || "jpg";
        const fileName = `${state.user.id}/avatar-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, blob, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        const publicUrl = publicUrlData.publicUrl;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", state.user.id);

        if (updateError) throw updateError;

        if (state.roles.includes("profissional")) {
          await supabase
            .from("profissional_perfil")
            .update({ foto_url: publicUrl })
            .eq("user_id", state.user.id);
        }

        setState((s) => ({
          ...s,
          profile: s.profile ? { ...s.profile, avatar_url: publicUrl } : null,
        }));
      } catch (err: unknown) {
        console.error("[useAuth] Erro ao atualizar foto:", err);
        throw err;
      }
    },
    updateUserData: (_: unknown) => {},
  };
}
