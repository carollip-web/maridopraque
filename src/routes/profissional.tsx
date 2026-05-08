import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SLABadge } from "@/components/SLABadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { enviarOrcamento } from "@/lib/orcamentos.functions";
import {
  Wrench,
  Clock,
  CheckCircle2,
  Loader2,
  LogOut,
  Send,
  Pencil,
  XCircle,
  CreditCard,
  User,
  Package,
} from "lucide-react";

export const Route = createFileRoute("/profissional")({
  component: ProfissionalArea,
});

type Orcamento = {
  id: string;
  service_id: string | null;
  service_name: string;
  descricao: string | null;
  valor: number | null;
  valor_servico: number | null;
  taxa_material: number;
  status:
    | "fixo_auto"
    | "customizado_pendente"
    | "enviado"
    | "aprovado"
    | "recusado"
    | "pago"
    | "cancelado";
  cliente_id: string;
  profissional_id: string | null;
  observacoes_profissional: string | null;
  created_at: string;
  updated_at: string;
  data_aprovacao: string | null;
  data_pagamento: string | null;
  auto_aprovado: boolean;
};

type ServicoCat = { id: string; preco_min: number | null; preco_max: number | null };
type OrcMat = { orcamento_id: string; nome_snapshot: string; unidade_snapshot: string; quantidade: number; subtotal: number };

type Profile = { id: string; nome: string; whatsapp: string | null; email: string | null };

const STATUS_META: Record<Orcamento["status"], { label: string; className: string }> = {
  customizado_pendente: { label: "Aguardando seu orçamento", className: "bg-amber-100 text-amber-800" },
  enviado: { label: "Enviado ao cliente", className: "bg-sky-100 text-sky-800" },
  fixo_auto: { label: "Preço fixo", className: "bg-slate-100 text-slate-700" },
  aprovado: { label: "Aprovado", className: "bg-emerald-100 text-emerald-800" },
  pago: { label: "Pago", className: "bg-emerald-600 text-white" },
  recusado: { label: "Recusado", className: "bg-red-100 text-red-700" },
  cancelado: { label: "Cancelado", className: "bg-slate-200 text-slate-600" },
};

function ProfissionalArea() {
  const { user, isProfissional, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loadingList, setLoadingList] = useState(true);
  const enviar = useServerFn(enviarOrcamento);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user]);

  const [catalog, setCatalog] = useState<Record<string, ServicoCat>>({});
  const [orcMats, setOrcMats] = useState<Record<string, OrcMat[]>>({});

  const refresh = async () => {
    const { data, error } = await supabase
      .from("orcamentos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar orçamentos", { description: error.message });
      setLoadingList(false);
      return;
    }
    const list = (data ?? []) as Orcamento[];
    setOrcamentos(list);

    const ids = Array.from(new Set(list.map((o) => o.cliente_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome, whatsapp, email")
        .in("id", ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p: any) => (map[p.id] = p));
      setProfiles(map);
    }

    const serviceIds = Array.from(new Set(list.map((o) => o.service_id).filter(Boolean) as string[]));
    if (serviceIds.length) {
      const { data: cats } = await supabase
        .from("services_catalog")
        .select("id, preco_min, preco_max")
        .in("id", serviceIds);
      const cmap: Record<string, ServicoCat> = {};
      (cats ?? []).forEach((c: any) => (cmap[c.id] = c));
      setCatalog(cmap);
    }

    const orcIds = list.map((o) => o.id);
    if (orcIds.length) {
      const { data: oms } = await supabase
        .from("orcamento_materiais")
        .select("orcamento_id, nome_snapshot, unidade_snapshot, quantidade, subtotal")
        .in("orcamento_id", orcIds);
      const grouped: Record<string, OrcMat[]> = {};
      (oms ?? []).forEach((m: any) => {
        (grouped[m.orcamento_id] ||= []).push(m as OrcMat);
      });
      setOrcMats(grouped);
    }

    setLoadingList(false);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    const channel = supabase
      .channel("prof-orc")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orcamentos" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const counts = useMemo(() => {
    return {
      pendentes: orcamentos.filter((o) => o.status === "customizado_pendente").length,
      enviados: orcamentos.filter((o) => o.status === "enviado").length,
      ativos: orcamentos.filter((o) => o.status === "aprovado" || o.status === "pago").length,
      finalizados: orcamentos.filter((o) => o.status === "recusado" || o.status === "cancelado").length,
    };
  }, [orcamentos]);

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }

  if (!isProfissional) {
    return (
      <div className="max-w-md mx-auto py-32 text-center px-4">
        <h1 className="text-2xl font-bold mb-3">Acesso restrito</h1>
        <p className="text-muted-foreground mb-6">
          Esta área é exclusiva para profissionais cadastrados. Fale com o admin para obter acesso.
        </p>
        <Link to="/" className="text-brand font-bold underline">
          Voltar ao início
        </Link>
      </div>
    );
  }

  const filterBy = (statuses: Orcamento["status"][]) =>
    orcamentos.filter((o) => statuses.includes(o.status));

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
          <button
            onClick={logout}
            className="text-sm flex items-center gap-2 text-background/70 hover:text-background"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={Clock} label="Pendentes" value={counts.pendentes} accent="bg-amber-100 text-amber-800" />
          <Stat icon={Send} label="Enviados" value={counts.enviados} accent="bg-sky-100 text-sky-800" />
          <Stat icon={CheckCircle2} label="Em andamento" value={counts.ativos} accent="bg-emerald-100 text-emerald-800" />
          <Stat icon={XCircle} label="Encerrados" value={counts.finalizados} accent="bg-slate-100 text-slate-700" />
        </div>

        {loadingList ? (
          <div className="p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="pendentes" className="w-full">
            <TabsList className="bg-white border border-border rounded-full h-auto p-1 flex-wrap">
              <TabsTrigger value="pendentes" className="rounded-full">
                Pendentes ({counts.pendentes})
              </TabsTrigger>
              <TabsTrigger value="enviados" className="rounded-full">
                Aguardando cliente ({counts.enviados})
              </TabsTrigger>
              <TabsTrigger value="ativos" className="rounded-full">
                Em andamento ({counts.ativos})
              </TabsTrigger>
              <TabsTrigger value="finalizados" className="rounded-full">
                Encerrados ({counts.finalizados})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pendentes" className="mt-6">
              <Grid items={filterBy(["customizado_pendente"])} profiles={profiles} catalog={catalog} orcMats={orcMats} mode="enviar" enviar={enviar} emptyMsg="Nenhuma solicitação aguardando." />
            </TabsContent>
            <TabsContent value="enviados" className="mt-6">
              <Grid items={filterBy(["enviado"])} profiles={profiles} catalog={catalog} orcMats={orcMats} mode="revisar" enviar={enviar} emptyMsg="Nenhum orçamento aguardando aprovação do cliente." />
            </TabsContent>
            <TabsContent value="ativos" className="mt-6">
              <Grid items={filterBy(["aprovado", "pago"])} profiles={profiles} catalog={catalog} orcMats={orcMats} mode="info" enviar={enviar} emptyMsg="Nenhum serviço em andamento." />
            </TabsContent>
            <TabsContent value="finalizados" className="mt-6">
              <Grid items={filterBy(["recusado", "cancelado"])} profiles={profiles} catalog={catalog} orcMats={orcMats} mode="info" enviar={enviar} emptyMsg="Sem orçamentos encerrados." />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-full grid place-items-center ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

function Grid({
  items,
  profiles,
  catalog,
  orcMats,
  mode,
  enviar,
  emptyMsg,
}: {
  items: Orcamento[];
  profiles: Record<string, Profile>;
  catalog: Record<string, ServicoCat>;
  orcMats: Record<string, OrcMat[]>;
  mode: "enviar" | "revisar" | "info";
  enviar: any;
  emptyMsg: string;
}) {
  if (items.length === 0) {
    return (
      <div className="p-10 text-center text-muted-foreground bg-white rounded-2xl border border-border">
        {emptyMsg}
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((o) => (
        <OrcamentoCard
          key={o.id}
          o={o}
          cliente={profiles[o.cliente_id]}
          range={o.service_id ? catalog[o.service_id] : undefined}
          materiais={orcMats[o.id] ?? []}
          mode={mode}
          enviar={enviar}
        />
      ))}
    </div>
  );
}

function OrcamentoCard({
  o,
  cliente,
  range,
  materiais,
  mode,
  enviar,
}: {
  o: Orcamento;
  cliente: Profile | undefined;
  range: ServicoCat | undefined;
  materiais: OrcMat[];
  mode: "enviar" | "revisar" | "info";
  enviar: any;
}) {
  const [editing, setEditing] = useState(mode === "enviar");
  const initialValor = o.valor_servico ?? o.valor ?? null;
  const [valor, setValor] = useState(initialValor != null ? String(initialValor).replace(".", ",") : "");
  const [obs, setObs] = useState(o.observacoes_profissional ?? "");
  const [saving, setSaving] = useState(false);

  const meta = STATUS_META[o.status];
  const min = range?.preco_min != null ? Number(range.preco_min) : null;
  const max = range?.preco_max != null ? Number(range.preco_max) : null;

  const handleEnviar = async () => {
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (min != null && max != null && (v < min || v > max)) {
      toast.error(`Valor fora do range tabelado (R$ ${min.toFixed(2)} – R$ ${max.toFixed(2)})`);
      return;
    }
    setSaving(true);
    try {
      await enviar({ data: { orcamentoId: o.id, valorServico: v, observacoes: obs || undefined } });
      toast.success(mode === "revisar" ? "Orçamento atualizado" : "Orçamento enviado ao cliente");
      if (mode === "revisar") setEditing(false);
    } catch (e: any) {
      toast.error("Falha ao salvar", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const slaHoras = o.status === "customizado_pendente" ? 4 : o.status === "enviado" ? 24 : null;

  return (
    <div className="bg-white rounded-2xl border border-border p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold truncate">{o.service_name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(o.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${meta.className}`}>
            {meta.label}
          </span>
          {slaHoras && <SLABadge createdAt={o.created_at} prazoHoras={slaHoras} />}
        </div>
      </div>

      <div className="text-sm space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-4 w-4 shrink-0" />
          <span className="truncate">{cliente?.nome || "Cliente"}</span>
        </div>
        {o.descricao && (
          <p className="text-muted-foreground bg-slate-50 rounded-xl p-3 text-sm">
            {o.descricao}
          </p>
        )}
        {o.valor != null && !editing && (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Total</span>
              <span className="text-lg font-bold">R$ {Number(o.valor).toFixed(2)}</span>
            </div>
            {(Number(o.valor_servico ?? 0) > 0 || Number(o.taxa_material) > 0) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Mão de obra R$ {Number(o.valor_servico ?? 0).toFixed(2)} · Materiais R$ {Number(o.taxa_material).toFixed(2)}
              </p>
            )}
          </div>
        )}
        {materiais.length > 0 && (
          <div className="rounded-xl bg-slate-50 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
              <Package className="h-3 w-3" /> Materiais ({materiais.length})
            </div>
            <ul className="text-xs space-y-0.5">
              {materiais.map((m, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {m.nome_snapshot} <span className="text-muted-foreground">× {Number(m.quantidade)} {m.unidade_snapshot}</span>
                  </span>
                  <span className="tabular-nums font-medium">R$ {Number(m.subtotal).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {o.observacoes_profissional && !editing && (
          <p className="text-sm text-muted-foreground italic">"{o.observacoes_profissional}"</p>
        )}
        {o.status === "pago" && o.data_pagamento && (
          <p className="text-xs text-emerald-700 flex items-center gap-1">
            <CreditCard className="h-3.5 w-3.5" />
            Pago em {new Date(o.data_pagamento).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>

      {(mode === "enviar" || (mode === "revisar" && editing)) && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div>
            <label className="text-xs uppercase font-bold text-muted-foreground">Mão de obra (R$)</label>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="ex: 180,00"
              inputMode="decimal"
              className="w-full mt-1 h-11 px-3 rounded-xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            {min != null && max != null && (
              <p className="text-xs text-muted-foreground mt-1">
                Range tabelado: <span className="font-semibold text-foreground">R$ {min.toFixed(2)} a R$ {max.toFixed(2)}</span>
              </p>
            )}
            {Number(o.taxa_material) > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Materiais: R$ {Number(o.taxa_material).toFixed(2)} (já cotados pelo cliente)
              </p>
            )}
          </div>
          <div>
            <label className="text-xs uppercase font-bold text-muted-foreground">Observações</label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              maxLength={500}
              placeholder="Detalhes sobre o serviço, prazo, materiais inclusos…"
              className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            {mode === "revisar" && (
              <Button
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="rounded-full"
              >
                Cancelar
              </Button>
            )}
            <Button
              onClick={handleEnviar}
              disabled={saving}
              className="flex-1 bg-brand text-brand-foreground rounded-full font-bold"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "revisar" ? (
                "Salvar nova proposta"
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5" /> Enviar ao cliente
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {mode === "revisar" && !editing && (
        <Button
          variant="outline"
          onClick={() => setEditing(true)}
          className="rounded-full w-full"
        >
          <Pencil className="h-4 w-4 mr-1.5" /> Revisar orçamento
        </Button>
      )}
    </div>
  );
}
