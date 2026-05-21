import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Mail, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/convite")({
  component: ConvitePage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo de 6 caracteres").max(128),
});

function ConvitePage() {
  const { id } = Route.useSearch<{ id?: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [leadInfo, setLeadInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!id) {
      setError("Link de convite inválido ou ausente.");
      setLoading(false);
      return;
    }

    const checkInvite = async () => {
      const { data, error } = await supabase.rpc("verificar_convite", { p_convite_id: id });
      if (error) {
        setError("Erro ao validar convite.");
      } else if (data?.valido) {
        setLeadInfo(data);
      } else {
        setError(data?.erro || "Convite não é mais válido.");
      }
      setLoading(false);
    };

    checkInvite();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setSubmitting(true);
    try {
      const { error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/profissional-cadastro`,
          data: { 
            nome: leadInfo.nome,
            convite_id: id // Isso será lido pelo trigger no banco para criar o perfil!
          },
        },
      });

      if (signupError) throw signupError;
      
      setSuccess(true);
      toast.success("Conta criada com sucesso!");
    } catch (err: any) {
      setError(err?.message ?? "Erro ao criar conta");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive text-center">Convite Inválido</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-slate-600 mb-6">{error}</p>
            <Button onClick={() => navigate({ to: "/" })} className="w-full">
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md animate-in zoom-in duration-500">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Conta Criada!</CardTitle>
            <CardDescription className="text-base mt-2">
              Seja bem-vindo, {leadInfo?.nome}!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-slate-600 mb-6">
              Sua conta profissional foi gerada com sucesso. Verifique seu e-mail para confirmar seu cadastro, e então faça login para completar seu perfil e enviar seus documentos.
            </p>
            <Button onClick={() => navigate({ to: "/login" })} className="w-full bg-brand">
              Ir para o Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-brand/30 p-4">
      <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500 border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="h-6 w-6 text-brand" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Convite Exclusivo</CardTitle>
          <CardDescription className="text-base mt-2 text-slate-500">
            Olá, <span className="font-semibold text-slate-900">{leadInfo?.nome}</span>! 
            Sua vaga como parceiro(a) de <span className="font-semibold text-brand">{leadInfo?.especialidade}</span> está garantida.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <p className="text-sm text-slate-500 text-center mb-4">
                Crie seu e-mail e senha para acessar o aplicativo do profissional.
              </p>
            </div>
            {error && (
              <div className="p-3 text-sm text-destructive-foreground bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">E-mail de Acesso</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  placeholder="Seu melhor e-mail"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Crie uma Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  placeholder="No mínimo 6 caracteres"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full font-bold bg-brand text-brand-foreground hover:bg-brand/90 h-12 text-base mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando conta...
                </>
              ) : (
                "Criar Minha Conta Profissional"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
