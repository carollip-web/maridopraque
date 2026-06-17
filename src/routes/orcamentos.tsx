import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Save, Trash2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Feature modules
import { ROUTE_HEAD_META } from "@/features/orcamentos/constants";
import { useOrcamentosData } from "@/features/orcamentos/useOrcamentosData";
import { useOrcamentoCatalog } from "@/features/orcamentos/useOrcamentoCatalog";
import { useOrcamentoDraft } from "@/features/orcamentos/useOrcamentoDraft";
import { useOrcamentoForm } from "@/features/orcamentos/useOrcamentoForm";
import { OrcamentoWizard } from "@/features/orcamentos/OrcamentoWizard";
import { OrcamentoListItem } from "@/features/orcamentos/OrcamentoListItem";

export const Route = createFileRoute("/orcamentos")({
  validateSearch: (s: Record<string, unknown>) => ({
    new: s.new === "1" || s.new === 1 || s.new === true ? 1 : undefined,
    serviceName: typeof s.serviceName === "string" ? s.serviceName : undefined,
    serviceId: typeof s.serviceId === "string" ? s.serviceId : undefined,
    categoria: typeof s.categoria === "string" ? s.categoria : undefined,
  }),
  head: () => ({ meta: ROUTE_HEAD_META }),
  errorComponent: ({ error }) => (
    <div className="p-12 text-center space-y-4 max-w-2xl mx-auto">
      <div className="bg-red-50 text-red-600 p-6 rounded-3xl border border-red-100">
        <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h2 className="text-2xl font-black tracking-tight mb-2">
          Ops! Algo deu errado.
        </h2>
        <p className="text-sm font-medium opacity-80 mb-6">
          Ocorreu um erro inesperado ao carregar seus orçamentos.
        </p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="rounded-full border-red-200 hover:bg-red-100"
        >
          Tentar novamente
        </Button>
      </div>
      {process.env.NODE_ENV === "development" && (
        <div className="text-left mt-8 p-4 bg-slate-900 text-slate-300 rounded-2xl overflow-auto text-[10px] font-mono leading-relaxed shadow-xl border border-slate-800">
          <p className="text-red-400 font-bold mb-2">DEV ERROR LOG:</p>
          {error.message}
          {"\n\n"}
          {error.stack}
        </div>
      )}
    </div>
  ),
  component: MeusOrcamentos,
});

function MeusOrcamentos() {
  const { user, loading } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();

  // Auth guard: redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  // Lista + materiais + propostas (com realtime)
  const { list, orcMats, propostas, refresh } = useOrcamentosData(user);

  // Callback do draft é resolvido depois — usamos ref para quebrar a dependência circular
  // entre form (que precisa limpar o rascunho ao submeter) e draft (que depende do form state).
  const clearStoredRef = useRef<() => void>(() => {});

  // Catálogo de serviços/materiais (sem dependência do form ainda)
  const catalog = useOrcamentoCatalog("", {});

  // Form do wizard
  const form = useOrcamentoForm({
    user,
    servicos: catalog.servicos,
    orcMats,
    search,
    refresh,
    onClearStoredDraft: () => clearStoredRef.current(),
  });

  // Derivações dependentes do form (servico selecionado, materiais sugeridos, subtotal)
  const selServico = useMemo(
    () => catalog.servicos.find((s) => s.id === form.selServiceId),
    [catalog.servicos, form.selServiceId],
  );
  const sugeridos = useMemo(() => {
    if (!form.selServiceId) return [];
    const ids = catalog.serviceMats
      .filter((sm) => sm.service_id === form.selServiceId)
      .map((sm) => sm.material_id);
    return catalog.materiais.filter((m) => ids.includes(m.id));
  }, [form.selServiceId, catalog.serviceMats, catalog.materiais]);
  const subtotalMat = useMemo(
    () =>
      Object.entries(form.picked).reduce((s, [id, qty]) => {
        const m = catalog.materiais.find((x) => x.id === id);
        return s + (m ? Number(m.preco_atual) * qty : 0);
      }, 0),
    [form.picked, catalog.materiais],
  );

  // Snapshot enviado ao hook de rascunho
  const draftKey = user ? `orc-draft-${user.id}` : null;
  const draftSnapshot = useMemo(
    () => ({
      selServiceId: form.selServiceId,
      descricao: form.descricao,
      tipoAtendimento: form.tipoAtendimento,
      dataPreferida: form.dataPreferida,
      periodoPreferido: form.periodoPreferido,
      horarioPreferido: form.horarioPreferido,
      flexibilidadeAgenda: form.flexibilidadeAgenda,
      picked: form.picked,
      step: form.step,
    }),
    [
      form.selServiceId,
      form.descricao,
      form.tipoAtendimento,
      form.dataPreferida,
      form.periodoPreferido,
      form.horarioPreferido,
      form.flexibilidadeAgenda,
      form.picked,
      form.step,
    ],
  );

  const draft = useOrcamentoDraft({
    draftKey,
    showNew: form.showNew,
    editingId: form.editingId,
    snapshot: draftSnapshot,
    apply: form.applyDraft,
  });

  // Fecha o ciclo: o form chama clearStored ao submeter com sucesso
  clearStoredRef.current = draft.clearStored;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Orçamentos</h1>
          <p className="text-muted-foreground mt-1">
            Preço tabelado e materiais opcionais.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {draft.hasDraft && !form.showNew && (
            <div className="flex items-center bg-slate-50 p-1 rounded-full border border-slate-100">
              <Button
                onClick={draft.carregarRascunho}
                variant="ghost"
                size="sm"
                className="rounded-full text-xs gap-2 font-bold text-slate-600"
              >
                <Save className="h-3.5 w-3.5" /> Retomar rascunho
              </Button>
              <Button
                onClick={draft.limparRascunho}
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8 text-slate-400 hover:text-red-500"
                aria-label="Descartar rascunho"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <Button
            onClick={() => {
              if (form.showNew) form.resetForm();
              else {
                form.setStep(1);
                form.setShowNew(true);
              }
            }}
            variant={form.showNew ? "ghost" : "default"}
            size={form.showNew ? "sm" : "default"}
            className={`rounded-full gap-2 font-bold ${
              form.showNew
                ? "text-red-500 hover:bg-red-50"
                : "bg-brand text-brand-foreground shadow-md"
            }`}
          >
            {form.showNew ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {form.showNew ? "Cancelar pedido" : "Nova solicitação"}
          </Button>
        </div>
      </div>

      {form.showNew && (
        <OrcamentoWizard
          form={form}
          user={user}
          servicos={catalog.servicos}
          materiais={catalog.materiais}
          serviceMats={catalog.serviceMats}
          selServico={selServico}
          sugeridos={sugeridos}
          subtotalMat={subtotalMat}
          draftSavedAt={draft.draftSavedAt}
        />
      )}

      <div className="space-y-4">
        {list.length === 0 && (
          <div className="p-12 text-center text-muted-foreground bg-white rounded-2xl border border-border">
            Você ainda não tem orçamentos.{" "}
            <Link to="/servicos" className="text-brand font-bold underline">
              Ver serviços
            </Link>
          </div>
        )}
        {list.map((o) => (
          <OrcamentoListItem
            key={o.id}
            o={o}
            materiais={orcMats[o.id] ?? []}
            propostas={propostas[o.id] ?? []}
            expanded={!!expanded[o.id]}
            onToggleExpanded={() =>
              setExpanded((p) => ({ ...p, [o.id]: !p[o.id] }))
            }
            onEdit={form.startEdit}
            refresh={refresh}
          />
        ))}
      </div>
    </div>
  );
}
