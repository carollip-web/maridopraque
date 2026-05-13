import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Wrench, CheckSquare, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const authSchema = z.object({
  nome: z.string().trim().min(1, "Informe seu nome").max(100).optional(),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo de 6 caracteres").max(128),
});

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const parsed = authSchema.safeParse({ nome: isRegistering ? nome : undefined, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setLoading(true);
    try {
      if (isRegistering) {
        const { error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/cliente`,
            data: { nome },
          },
        });
        if (signupError) throw signupError;
        setInfo("Conta criada! Verifique seu e-mail para confirmar antes de entrar.");
      } else {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
        // Redireciona conforme o papel do usuário
        const userId = data.user?.id;
        let dest: any = "/cliente";
        if (userId) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          const r = (roles ?? []).map((x: any) => x.role);
          if (r.includes("admin")) dest = "/admin";
          else if (r.includes("profissional")) dest = "/profissional";
        }
        navigate({ to: dest });
      }
    } catch (err: any) {
      setError(err?.message ?? "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/cliente` },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-[calc(100-64px)] flex items-center justify-center p-4 py-20 bg-slate-50/50">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background">
              <Wrench className="h-5 w-5" />
            </span>
            <span className="text-xl font-bold tracking-tight">
              Marido pra Quê<span className="text-brand">?</span>
            </span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {isRegistering ? "Crie sua conta" : "Bem-vinda de volta"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isRegistering
              ? "Cadastre-se para gerenciar seus serviços com facilidade."
              : "Acesse sua área exclusiva para acompanhar pedidos e orçamentos."}
          </p>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-border p-8 shadow-xl">
          <form className="space-y-5" onSubmit={handleAuth}>
            {isRegistering && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Nome Completo</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Carolina Silva"
                  className="w-full h-12 px-4 rounded-2xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20 transition"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full h-12 pl-11 pr-4 rounded-2xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20 transition"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Senha</label>
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

            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => setKeepLoggedIn(!keepLoggedIn)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground ml-1">
                {keepLoggedIn ? <CheckSquare className="h-4 w-4 text-brand" /> : <Square className="h-4 w-4" />}
                Manter conectado
              </button>
              {!isRegistering && (
                <button
                  type="button"
                  onClick={async () => {
                    setError(null); setInfo(null);
                    if (!email) return setError("Digite seu e-mail acima primeiro.");
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) setError(error.message);
                    else setInfo("Enviamos um link de recuperação para seu e-mail.");
                  }}
                  className="text-sm font-medium text-brand hover:underline mr-1"
                >
                  Esqueci a senha
                </button>
              )}
            </div>

            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
            {info && <p className="text-sm text-green-700 font-medium">{info}</p>}

            <Button type="submit" disabled={loading} size="lg" className="w-full h-14 rounded-full bg-foreground text-background hover:bg-foreground/90 font-bold shadow-lg mt-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isRegistering ? "Criar Minha Conta" : "Entrar Agora"}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <span className="bg-white px-4">Ou continue com</span>
            </div>
          </div>

          <button onClick={handleGoogle} className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-white hover:bg-muted transition-colors font-medium text-sm">
            Continuar com Google
          </button>
        </div>

        <p className="text-center mt-8 text-sm text-muted-foreground">
          {isRegistering ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
          <button onClick={() => setIsRegistering(!isRegistering)} className="font-bold text-brand hover:underline">
            {isRegistering ? "Faça login" : "Cadastre-se grátis"}
          </button>
        </p>

        <p className="text-center mt-3 text-sm text-muted-foreground">
          É profissional parceiro?{" "}
          <Link to="/login/profissional" className="font-bold text-foreground hover:underline">
            Entrar como profissional
          </Link>
        </p>

        <div className="mt-12 flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <ShieldCheck className="h-4 w-4" />
          Ambiente 100% Seguro e Criptografado
        </div>
      </div>
    </div>
  );
}
