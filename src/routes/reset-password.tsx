import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Eye, EyeOff, Wrench, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  // O Supabase coloca o session token no hash quando o usuário clica no link de recovery
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 6) return setError("Mínimo de 6 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    setInfo("Senha alterada com sucesso! Redirecionando...");
    setTimeout(() => navigate({ to: "/cliente", search: { tab: "inicio", id: undefined, pedidoId: undefined, chat: undefined, details: false } as any }), 1500);
  };

  return (
    <div className="min-h-[calc(100-64px)] flex items-center justify-center p-4 py-20 bg-slate-50/50">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background">
              <Wrench className="h-5 w-5" />
            </span>
            <span className="text-xl font-bold tracking-tight">
              Marido pra Quê<span className="text-brand">?</span>
            </span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Redefinir senha</h1>
          <p className="text-muted-foreground mt-2">Escolha uma nova senha para sua conta.</p>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-border p-8 shadow-xl">
          {!ready ? (
            <p className="text-sm text-muted-foreground text-center">
              Validando link de recuperação... Se você abriu esta página direto, peça um novo link em
              <Link to="/login" className="text-brand font-bold hover:underline"> Esqueci a senha</Link>.
            </p>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Nova senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-12 rounded-2xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20 transition"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Confirmar senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-4 rounded-2xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20 transition"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
              {info && <p className="text-sm text-green-700 font-medium">{info}</p>}

              <Button type="submit" disabled={loading} size="lg" className="w-full h-14 rounded-full bg-foreground text-background hover:bg-foreground/90 font-bold shadow-lg mt-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
