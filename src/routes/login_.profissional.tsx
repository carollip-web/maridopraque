import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Wrench,
  Loader2,
  Briefcase,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const Route = createFileRoute("/login_/profissional")({
  head: () => ({
    meta: [
      { title: "Acesso Profissional | Marido pra Quê?" },
      {
        name: "description",
        content:
          "Área exclusiva para profissionais cadastrados no Marido pra Quê?. Acesse seu painel de orçamentos e atendimentos.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LoginProfissionalPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo de 6 caracteres").max(128),
});

function LoginProfissionalPage() {
  const [showPassword, setShowPassword] = useState(false);
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

    const parsed = schema.safeParse({ email, password });
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

      const userId = data.user?.id;
      if (!userId) throw new Error("Sessão inválida. Tente novamente.");

      // Valida se o usuário tem perfil de profissional
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (rolesError) throw rolesError;

      const lista = (roles ?? []).map((r: any) => r.role);
      const isProf = lista.includes("profissional") || lista.includes("admin");

      if (!isProf) {
        await supabase.auth.signOut();
        setError(
          "Esta conta não tem acesso de profissional. Caso queira se candidatar, entre em contato com a equipe Marido pra Quê?.",
        );
        return;
      }

      // Garante que existe um perfil_profissional vinculado e verifica status
      let precisaCompletarCadastro = false;
      try {
        const { data: perfil } = await supabase
          .from("profissional_perfil")
          .select("user_id, cadastro_completo, aprovacao_status")
          .eq("user_id", userId)
          .maybeSingle();
        if (!perfil) {
          await supabase.from("profissional_perfil").insert({ user_id: userId, ativo: false });
          precisaCompletarCadastro = true;
          setInfo("Bem-vindo! Complete seu cadastro para enviar para validação.");
        } else if (!perfil.cadastro_completo || perfil.aprovacao_status === "incompleto") {
          precisaCompletarCadastro = true;
          setInfo("Continue de onde parou e envie seu cadastro para validação.");
        }
      } catch {
        // silencioso — usuário pode completar manualmente
      }

      if (lista.includes("admin")) {
        navigate({ to: "/admin" });
      } else if (precisaCompletarCadastro) {
        navigate({ to: "/profissional-cadastro" });
      } else {
        navigate({ to: "/profissional" });
      }

    } catch (err: any) {
      setError(err?.message ?? "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-brand/30">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 mb-6 text-sm text-white/70 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para login de cliente
        </Link>

        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-foreground">
              <Wrench className="h-5 w-5" />
            </span>
            <span className="text-xl font-bold tracking-tight text-white">
              Marido pra Quê<span className="text-brand">?</span>
            </span>
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-foreground/90 mb-4">
            <Briefcase className="h-3.5 w-3.5" />
            Acesso Profissional
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Painel do Profissional</h1>
          <p className="text-white/70 mt-2">Entre para acessar seus orçamentos, agenda e ganhos.</p>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-border p-8 shadow-2xl">
          <form className="space-y-5" onSubmit={handleAuth}>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="profissional@email.com"
                  className="w-full h-12 pl-11 pr-4 rounded-2xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20 transition"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 pl-11 pr-12 rounded-2xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setInfo(null);
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
            </div>

            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
            {info && <p className="text-sm text-green-700 font-medium">{info}</p>}

            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="w-full h-14 rounded-full bg-brand text-brand-foreground hover:bg-brand/90 font-bold shadow-lg mt-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar no Painel"}
            </Button>
          </form>

          <p className="text-center mt-6 text-xs text-muted-foreground">
            Ainda não é parceiro?{" "}
            <Link to="/para-profissionais" className="font-bold text-brand hover:underline">
              Candidate-se aqui
            </Link>
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
          <ShieldCheck className="h-4 w-4" />
          Ambiente 100% Seguro e Criptografado
        </div>
      </div>
    </div>
  );
}
