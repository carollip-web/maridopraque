import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/redirect")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AuthRedirectPage,
});

function AuthRedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const decide = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session?.user) {
        navigate({ to: "/login" });
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (cancelled) return;

      const list = (roles ?? []).map((r: any) => r.role);
      let dest: "/admin" | "/profissional" | "/cliente" = "/cliente";
      if (list.includes("admin")) dest = "/admin";
      else if (list.includes("profissional")) dest = "/profissional";

      navigate({ to: dest, replace: true } as Parameters<typeof navigate>[0]);
    };

    decide();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-medium">Redirecionando…</span>
      </div>
    </div>
  );
}
