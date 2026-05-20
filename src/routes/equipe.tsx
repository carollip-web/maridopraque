import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const Route = createFileRoute("/equipe")({
  component: EquipePage,
});

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo de 6 caracteres").max(128),
});

function EquipePage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setLoading(true);
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) throw loginError;

      // Busca role ANTES de qualquer decisão de navegação
      const userId = data.user?.id;
      let isAdmin = false;

      if (userId) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        isAdmin = (roles ?? []).some((x: any) => x.role === "admin");
      }

      if (isAdmin) {
        // Só navega após confirmar role admin
        navigate({ to: "/admin" });
        return;
      }

      // Não é admin — encerrar sessão e NUNCA navegar
      try {
        const { error: signOutErr } = await supabase.auth.signOut();
        if (signOutErr) {
          // Fallback: limpa sessão local mesmo se o servidor falhar
          await supabase.auth.signOut({ scope: "local" });
        }
      } catch {
        // Último recurso: garante limpeza local
        await supabase.auth.signOut({ scope: "local" });
      }

      setError("Acesso restrito à equipe administrativa.");
    } catch (err: any) {
      setError(err?.message ?? "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-20 bg-slate-900">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-6">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 border border-slate-700 shadow-lg">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Acesso da Equipe
          </h1>
          <p className="text-slate-400 mt-2">
            Painel interno — restrito a colaboradores autorizados.
          </p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-sm rounded-[2.5rem] border border-slate-700 p-8 shadow-2xl">
          <form className="space-y-5" onSubmit={handleLogin}>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
                E-mail corporativo
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full h-12 pl-11 pr-4 rounded-2xl border border-slate-600 bg-slate-900 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 pl-11 pr-12 rounded-2xl border border-slate-600 bg-slate-900 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                <p className="text-sm text-red-400 font-medium">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="w-full h-14 rounded-full bg-emerald-600 text-white hover:bg-emerald-500 font-bold shadow-lg mt-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </div>

        <div className="mt-12 flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
          <ShieldCheck className="h-4 w-4" />
          Ambiente Interno Protegido
        </div>
      </div>
    </div>
  );
}
