import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { enviarOrcamento } from "@/lib/orcamentos.functions";
import { Wrench, Clock, CheckCircle2, Loader2, LogOut } from "lucide-react";

export const Route = createFileRoute("/profissional")({
  component: ProfissionalArea,
});

type Orcamento = {
  id: string;
  service_name: string;
  descricao: string | null;
  valor: number | null;
  status: string;
  cliente_id: string;
  profissional_id: string | null;
  observacoes_profissional: string | null;
  created_at: string;
};

function ProfissionalArea() {
  const { user, isProfissional, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const enviar = useServerFn(enviarOrcamento);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user]);

  const refresh = async () => {
    setLoadingList(true);
    const { data } = await supabase
      .from("orcamentos")
      .select("*")
      .in("status", ["customizado_pendente", "enviado", "aprovado"])
      .order("created_at", { ascending: false });
    setOrcamentos((data ?? []) as Orcamento[]);
    setLoadingList(false);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    const channel = supabase
      .channel("prof-orc")
      .on("postgres_changes", { event: "*", schema: "public", table: "orcamentos" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  if (loading) {
    return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  }
  if (!isProfissional) {
    return (
      <div className="max-w-md mx-auto py-32 text-center px-4">
        <h1 className="text-2xl font-bold mb-3">Acesso restrito</h1>
        <p className="text-muted-foreground mb-6">Esta área é exclusiva para profissionais cadastrados. Fale com o admin para obter acesso.</p>
        <Link to="/" className="text-brand font-bold underline">Voltar ao início</Link>
      </div>
    );
  }

  const pendentes = orcamentos.filter((o) => o.status === "customizado_pendente");
  const enviados = orcamentos.filter((o) => o.status === "enviado");
  const aprovados = orcamentos.filter((o) => o.status === "aprovado");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-foreground text-background">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench className="h-6 w-6 text-brand" />
            <div>
              <p className="text-xs uppercase tracking-widest text-background/60">Painel</p>
              <h1 className="font-bold text-lg">Profissional</h1>
            </div>
          </div>
          <button onClick={logout} className="text-sm flex items-center gap-2 text-background/70 hover:text-background">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <Section title="Aguardando seu orçamento" icon={Clock} count={pendentes.length}>
          {pendentes.map((o) => <OrcamentoCard key={o.id} o={o} mode="enviar" enviar={enviar} />)}
          {pendentes.length === 0 && <Empty msg="Nenhuma solicitação aguardando." />}
        </Section>

        <Section title="Enviados — aguardando cliente" icon={Clock} count={enviados.length}>
          {enviados.map((o) => <OrcamentoCard key={o.id} o={o} mode="info" enviar={enviar} />)}
          {enviados.length === 0 && <Empty msg="Nenhum orçamento aguardando aprovação do cliente." />}
        </Section>

        <Section title="Aprovados" icon={CheckCircle2} count={aprovados.length}>
          {aprovados.map((o) => <OrcamentoCard key={o.id} o={o} mode="info" enviar={enviar} />)}
          {aprovados.length === 0 && <Empty msg="Sem aprovações recentes." />}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, count, children }: any) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <Icon className="h-5 w-5 text-brand" />
        <h2 className="text-xl font-bold">{title}</h2>
        <span className="text-sm bg-slate-200 rounded-full px-3 py-0.5 font-medium">{count}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="md:col-span-2 p-8 text-center text-muted-foreground bg-white rounded-2xl border border-border">{msg}</div>;
}

function OrcamentoCard({ o, mode, enviar }: { o: Orcamento; mode: "enviar" | "info"; enviar: any }) {
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const handleEnviar = async () => {
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0) return;
    setSaving(true);
    try {
      await enviar({ data: { orcamentoId: o.id, valor: v, observacoes: obs || undefined } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold">{o.service_name}</h3>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")}</span>
      </div>
      {o.descricao && <p className="text-sm text-muted-foreground mb-4">{o.descricao}</p>}
      {o.valor != null && <p className="text-sm mb-4"><span className="font-medium">Valor:</span> R$ {Number(o.valor).toFixed(2)}</p>}
      {o.observacoes_profissional && <p className="text-sm text-muted-foreground italic mb-4">"{o.observacoes_profissional}"</p>}

      {mode === "enviar" && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div>
            <label className="text-xs uppercase font-bold text-muted-foreground">Valor (R$)</label>
            <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="ex: 180,00" className="w-full mt-1 h-11 px-3 rounded-xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20" />
          </div>
          <div>
            <label className="text-xs uppercase font-bold text-muted-foreground">Observações</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20" rows={2} />
          </div>
          <Button onClick={handleEnviar} disabled={saving} className="w-full bg-brand text-brand-foreground rounded-full font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar orçamento ao cliente"}
          </Button>
        </div>
      )}
    </div>
  );
}
