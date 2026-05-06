import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Chrome, Github, ShieldCheck, Wrench, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    login();
    navigate({ to: "/cliente" });
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
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Carolina Silva"
                    className="w-full h-12 px-4 rounded-2xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20 transition"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="email" 
                  placeholder="seu@email.com"
                  className="w-full h-12 pl-11 pr-4 rounded-2xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20 transition"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Senha</label>
                {!isRegistering && (
                  <button type="button" className="text-[10px] font-bold text-brand hover:underline">Esqueceu a senha?</button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••"
                  className="w-full h-12 pl-11 pr-12 rounded-2xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20 transition"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center pt-1">
              <button 
                type="button" 
                onClick={() => setKeepLoggedIn(!keepLoggedIn)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors ml-1"
              >
                {keepLoggedIn ? <CheckSquare className="h-4 w-4 text-brand" /> : <Square className="h-4 w-4" />}
                Manter conectado
              </button>
            </div>

            <Button type="submit" size="lg" className="w-full h-14 rounded-full bg-foreground text-background hover:bg-foreground/90 font-bold shadow-lg mt-2">
               {isRegistering ? "Criar Minha Conta" : "Entrar Agora"}
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

          <div className="grid grid-cols-2 gap-4">
            <button className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-white hover:bg-muted transition-colors font-medium text-sm">
              <Chrome className="h-4 w-4" /> Google
            </button>
            <button className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-white hover:bg-muted transition-colors font-medium text-sm">
              <Github className="h-4 w-4" /> GitHub
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-sm text-muted-foreground">
          {isRegistering ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="font-bold text-brand hover:underline"
          >
            {isRegistering ? "Faça login" : "Cadastre-se grátis"}
          </button>
        </p>

        <div className="mt-12 flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <ShieldCheck className="h-4 w-4" />
          Ambiente 100% Seguro e Criptografado
        </div>
      </div>
    </div>
  );
}
