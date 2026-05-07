import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { decidirOrcamento, solicitarOrcamento } from "@/lib/orcamentos.functions";
import { Loader2, CheckCircle2, XCircle, Clock, FileText, Plus } from "lucide-react";

export const Route = createFileRoute("/orcamentos")({
  component: MeusOrcamentos,
});

type O = {
  id: string;
  service_name: string;
  descricao: string | null;
  valor: number | null;
  status: string;
  auto_aprovado: boolean;
  observacoes_profissional: string | null;
  created_at: string;
};

const statusLabel: Record<string, { label: string; cls: string }> = {
  customizado_pendente: { label: "Aguardando profissional", cls: "bg-amber-50 text-amber-700" },
  fixo_auto: { label: "Pronto para aprovar", cls: "bg-blue-50 text-blue-700" },
  enviado: { label: "Aguardando sua aprovação", cls: "bg-blue-50 text-blue-700" },
  aprovado: { label: "Aprovado — pague para agendar", cls: "bg-green-50 text-green-700" },
  recusado: { label: "Recusado", cls: "bg-red-50 text-red-700" },
  pago: { label: "Pago", cls: "bg-green-50 text-green-700" },
  cancelado: { label: "Cancelado", cls: "bg-slate-100 text-slate-600" },
};

function MeusOrcamentos() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<O[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);
  const solicitar = useServerFn(solicitarOrcamento);
  const decidir = useServerFn(decidirOrcamento);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user]);

  const refresh = async () => {
    const { data } = await supabase.from("orcamentos").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as O[]);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    const ch = supabase
      .channel("cli-orc")
      .on("postgres_changes", { event: "*", schema: "public", table: "orcamentos", filter: `cliente_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const handleNew = async () => {
    if (!serviceName.trim()) return;
    setSaving(true);
    try {
      await solicitar({ data: { serviceId: null, serviceName: serviceName.trim(), descricao: descricao.trim() || undefined } });
      setServiceName(""); setDescricao(""); setShowNew(false);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Orçamentos</h1>
          <p className="text-muted-foreground mt-1">Acompanhe e aprove orçamentos automaticamente.</p>
        </div>
        <Button onClick={() => setShowNew(!showNew)} className="rounded-full bg-brand text-brand-foreground gap-2"><Plus className="h-4 w-4" /> Nova solicitação</Button>
      </div>

      {showNew && (
        <div className="bg-white rounded-2xl border border-border p-6 mb-6 shadow-soft space-y-3">
          <input value={serviceName} onChange={(e) => setServiceName(e.target.value)} maxLength={200} placeholder="Que serviço você precisa? (ex: Montagem de guarda-roupa)" className="w-full h-12 px-4 rounded-xl border border-border bg-slate-50" />
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={2000} placeholder="Descreva detalhes (opcional)" rows={3} className="w-full px-4 py-3 rounded-xl border border-border bg-slate-50" />
          <Button onClick={handleNew} disabled={saving} className="bg-foreground text-background rounded-full font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar solicitação"}
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {list.length === 0 && (
          <div className="p-12 text-center text-muted-foreground bg-white rounded-2xl border border-border">
            Você ainda não tem orçamentos. <Link to="/servicos" className="text-brand font-bold underline">Ver serviços</Link>
          </div>
        )}
        {list.map((o) => {
          const s = statusLabel[o.status] ?? { label: o.status, cls: "bg-slate-100 text-slate-700" };
          const podeAprovar = o.status === "enviado" || o.status === "fixo_auto";
          return (
            <div key={o.id} className="bg-white rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-bold text-lg">{o.service_name}</h3>
                  {o.descricao && <p className="text-sm text-muted-foreground mt-1">{o.descricao}</p>}
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${s.cls}`}>{s.label}</span>
              </div>

              {o.valor != null && <p className="text-2xl font-bold text-foreground mb-1">R$ {Number(o.valor).toFixed(2)}</p>}
              {o.observacoes_profissional && <p className="text-sm italic text-muted-foreground mb-3">"{o.observacoes_profissional}"</p>}
              {o.auto_aprovado && <p className="text-xs text-green-700 font-medium mb-3 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Aprovado automaticamente (cliente recorrente)</p>}

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                {podeAprovar && (
                  <>
                    <Button onClick={() => decidir({ data: { orcamentoId: o.id, decisao: "aprovado" } })} className="bg-green-600 hover:bg-green-700 text-white rounded-full gap-2 font-bold">
                      <CheckCircle2 className="h-4 w-4" /> Aprovar
                    </Button>
                    <Button onClick={() => decidir({ data: { orcamentoId: o.id, decisao: "recusado" } })} variant="outline" className="rounded-full gap-2">
                      <XCircle className="h-4 w-4" /> Recusar
                    </Button>
                  </>
                )}
                {o.status === "aprovado" && o.valor && (
                  <Button asChild className="bg-brand text-brand-foreground rounded-full font-bold">
                    <Link to="/checkout" search={{ service: o.service_name, price: Number(o.valor) }}>Pagar agora</Link>
                  </Button>
                )}
                {o.status === "customizado_pendente" && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Um profissional vai analisar e enviar o valor.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
