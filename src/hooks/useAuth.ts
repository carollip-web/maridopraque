import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Role = "cliente" | "profissional" | "admin";

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
  loading: boolean;
  rolesLoaded: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    roles: [],
    loading: true,
    rolesLoaded: false,
  });

  useEffect(() => {
    let mounted = true;

    const loadProfile = async (userId: string) => {
      const [{ data: profile }, { data: roles, error: rolesError }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (!mounted) return;
      if (rolesError) console.error("[useAuth] roles query error:", rolesError);
      setState((s) => ({
        ...s,
        profile: profile
          ? { id: profile.id, nome: profile.nome, email: profile.email, whatsapp: profile.whatsapp }
          : null,
        roles: (roles ?? []).map((r) => r.role as Role),
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
        setState((s) => ({ ...s, profile: null, roles: [], rolesLoaded: true }));
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

  return {
    ...state,
    // `loading` now stays true until session + roles are both resolved
    loading: !isReady,
    isLoggedIn: !!state.session,
    isProfissional: state.roles.includes("profissional") || state.roles.includes("admin"),
    isAdmin: state.roles.includes("admin"),
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
