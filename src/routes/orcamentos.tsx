import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { decidirOrcamento, editarOrcamento, solicitarOrcamento } from "@/lib/orcamentos.functions";
import { PhotoUploader } from "@/components/PhotoUploader";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Package,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Wrench,
  ClipboardCheck,
  Save,
  Pencil,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/orcamentos")({
  validateSearch: (s: Record<string, unknown>) => ({
    new: s.new === "1" || s.new === 1 || s.new === true ? 1 : undefined,
    serviceName: typeof s.serviceName === "string" ? s.serviceName : undefined,
    serviceId: typeof s.serviceId === "string" ? s.serviceId : undefined,
    categoria: typeof s.categoria === "string" ? s.categoria : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Meus Orçamentos — Solicitar online | Marido pra Quê?" },
      { name: "description", content: "Solicite orçamento online em 3 etapas: escolha o serviço, marque os materiais opcionais e envie. Resposta rápida do profissional." },
      { property: "og:title", content: "Orçamento online — Marido pra Quê?" },
      { property: "og:description", content: "Preço tabelado, materiais opcionais e acompanhamento em tempo real." },
    ],
  }),
  component: MeusOrcamentos,
});

type Servico = {
  id: string;
  nome: string;
  categoria: string;
  preco_min: number | null;
  preco_max: number | null;
};

type Material = {
  id: string;
  nome: string;
  unidade: string;
  preco_atual: number;
  preco_fonte: string;
};

type ServiceMaterial = {
  service_id: string;
  material_id: string;
  quantidade_sugerida: number;
};

type OrcamentoRow = {
  id: string;
  service_id: string | null;
  service_name: string;
  descricao: string | null;
  valor: number | null;
  valor_servico: number | null;
  taxa_material: number;
  status: string;
  auto_aprovado: boolean;
  observacoes_profissional: string | null;
  created_at: string;
};

type OrcMaterial = {
  id: string;
  orcamento_id: string;
  material_id: string;
  nome_snapshot: string;
  unidade_snapshot: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
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

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

function MeusOrcamentos() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const [list, setList] = useState<OrcamentoRow[]>([]);
  const [orcMats, setOrcMats] = useState<Record<string, OrcMaterial[]>>({});
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [serviceMats, setServiceMats] = useState<ServiceMaterial[]>([]);

  const [selServiceId, setSelServiceId] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [picked, setPicked] = useState<Record<string, number>>({}); // materialId -> qty
  const [fotos, setFotos] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  const draftKey = user ? `orc-draft-${user.id}` : null;

  const solicitar = useServerFn(solicitarOrcamento);
  const editar = useServerFn(editarOrcamento);
  const decidir = useServerFn(decidirOrcamento);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("orcamentos")
      .select("*")
      .eq("cliente_id", user.id)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as OrcamentoRow[];
    setList(rows);

    if (rows.length > 0) {
      const { data: mats } = await supabase
        .from("orcamento_materiais")
        .select("*")
        .in(
          "orcamento_id",
          rows.map((r) => r.id),
        );
      const grouped: Record<string, OrcMaterial[]> = {};
      (mats ?? []).forEach((m: any) => {
        (grouped[m.orcamento_id] ||= []).push(m as OrcMaterial);
      });
      setOrcMats(grouped);
    }
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    Promise.all([
      supabase.from("services_catalog").select("id, nome, categoria, preco_min, preco_max").eq("ativo", true),
      supabase.from("materiais").select("id, nome, unidade, preco_atual, preco_fonte").eq("ativo", true),
      supabase.from("service_materiais").select("*"),
    ]).then(([s, m, sm]) => {
      setServicos((s.data ?? []) as Servico[]);
      setMateriais((m.data ?? []).map((x: any) => ({ ...x, preco_atual: Number(x.preco_atual) })));
      setServiceMats((sm.data ?? []) as ServiceMaterial[]);
    });

    const ch = supabase
      .channel("cli-orc")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orcamentos", filter: `cliente_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Auto-abre o formulário quando vem de "Pedir orçamento agora" / catálogo.
  // Roda 1x quando os parâmetros mudam: abre imediatamente; tenta casar
  // serviceId (exato) e depois serviceName (normalizado, com fuzzy).
  // Sem match → form abre no passo 1 e avisamos no toast.
  const [autoMatched, setAutoMatched] = useState<string | null>(null);
  useEffect(() => {
    if (!search.new && !search.serviceId && !search.serviceName) return;
    setShowNew(true);

    // Aguarda o catálogo carregar antes de tentar casar (mas o form já está aberto)
    if (!servicos.length) return;

    // Chave para não re-rodar a cada digitação do form
    const key = `${search.serviceId ?? ""}|${search.serviceName ?? ""}|${search.new ?? ""}`;
    if (autoMatched === key) return;
    setAutoMatched(key);

    let matched: Servico | undefined;
    if (search.serviceId) {
      matched = servicos.find((x) => x.id === search.serviceId);
      // Validação extra: se vier com categoria, precisa bater
      if (matched && search.categoria) {
        const norm = (t: string) => t.toLowerCase().trim();
        if (norm(matched.categoria) !== norm(search.categoria)) {
          toast.error(`O serviço selecionado não pertence à categoria "${search.categoria}".`);
          matched = undefined;
        }
      }
      // serviceId passado mas não encontrado entre os ativos
      if (!matched && !search.serviceName) {
        toast.info("O serviço escolhido não está mais disponível. Selecione outro abaixo.");
      }
    }
    if (!matched && search.serviceName) {
      const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const target = norm(search.serviceName);
      const targetTokens = target.split(/\s+/).filter((t) => t.length >= 3);
      // Restringe ao escopo da categoria quando informada
      const pool = search.categoria
        ? servicos.filter((x) => norm(x.categoria) === norm(search.categoria!))
        : servicos;
      matched =
        pool.find((x) => norm(x.nome) === target) ||
        pool.find((x) => norm(x.nome).includes(target) || target.includes(norm(x.nome))) ||
        // Fallback por tokens: serviço cujo nome contém qualquer token relevante
        (targetTokens.length
          ? pool.find((x) => {
              const n = norm(x.nome);
              return targetTokens.some((t) => n.includes(t));
            })
          : undefined);
    }

    if (matched) {
      setSelServiceId(matched.id);
      // Mantém na etapa 1 para o usuário conferir o serviço auto-preenchido.
      setStep(1);
    } else if (search.serviceId || search.serviceName) {
      const label = search.serviceName ?? "selecionado";
      toast.info(`"${label}" não está no catálogo. Escolha o serviço mais próximo abaixo.`);
      setStep(1);
    }
  }, [servicos, search.new, search.serviceId, search.serviceName, search.categoria, autoMatched]);

  // Re-sincroniza o dropdown com o serviço da vitrine se o usuário voltar
  // para a etapa 1 e a seleção tiver sido perdida (ex.: limpeza acidental).
  useEffect(() => {
    if (step !== 1 || selServiceId || !showNew || editingId) return;
    if (!servicos.length) return;
    if (!search.serviceId && !search.serviceName) return;
    const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    let m: Servico | undefined;
    if (search.serviceId) m = servicos.find((x) => x.id === search.serviceId);
    if (!m && search.serviceName) {
      const target = norm(search.serviceName);
      const pool = search.categoria
        ? servicos.filter((x) => norm(x.categoria) === norm(search.categoria!))
        : servicos;
      m = pool.find((x) => norm(x.nome) === target) ||
          pool.find((x) => norm(x.nome).includes(target) || target.includes(norm(x.nome)));
    }
    if (m) setSelServiceId(m.id);
  }, [step, selServiceId, showNew, editingId, servicos, search.serviceId, search.serviceName, search.categoria]);

  const selServico = servicos.find((s) => s.id === selServiceId);
  const sugeridos = useMemo(() => {
    if (!selServiceId) return [] as Material[];
    const ids = serviceMats.filter((sm) => sm.service_id === selServiceId).map((sm) => sm.material_id);
    return materiais.filter((m) => ids.includes(m.id));
  }, [selServiceId, serviceMats, materiais]);

  const subtotalMat = useMemo(
    () =>
      Object.entries(picked).reduce((s, [id, qty]) => {
        const m = materiais.find((x) => x.id === id);
        return s + (m ? Number(m.preco_atual) * qty : 0);
      }, 0),
    [picked, materiais],
  );

  const togglePick = (id: string, defaultQty: number) => {
    setPicked((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = defaultQty;
      return next;
    });
  };

  const novoSchema = z.object({
    serviceId: z.string().uuid({ message: "Selecione um serviço válido." }),
    descricao: z.string().trim().max(2000, "Descrição muito longa.").optional(),
    materiais: z
      .array(z.object({ materialId: z.string().uuid(), quantidade: z.number().int().min(1).max(1000) }))
      .max(50, "Máximo de 50 itens de material."),
  });

  const resetForm = () => {
    setSelServiceId("");
    setDescricao("");
    setPicked({});
    setFotos([]);
    setStep(1);
    setShowNew(false);
    setEditingId(null);
  };

  // ----- Rascunho (localStorage) -----
  useEffect(() => {
    if (!draftKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) setHasDraft(true);
    } catch {}
  }, [draftKey]);

  // Auto-save enquanto o wizard está aberto em modo "novo"
  useEffect(() => {
    if (!draftKey || !showNew || editingId) return;
    if (typeof window === "undefined") return;
    if (!selServiceId && !descricao && Object.keys(picked).length === 0) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({ selServiceId, descricao, picked, step, savedAt: Date.now() }),
        );
        setDraftSavedAt(Date.now());
        setHasDraft(true);
      } catch {}
    }, 500);
    return () => window.clearTimeout(t);
  }, [draftKey, showNew, editingId, selServiceId, descricao, picked, step]);

  const carregarRascunho = () => {
    if (!draftKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        selServiceId?: string;
        descricao?: string;
        picked?: Record<string, number>;
        step?: 1 | 2 | 3;
      };
      setSelServiceId(d.selServiceId ?? "");
      setDescricao(d.descricao ?? "");
      setPicked(d.picked ?? {});
      setStep(d.step ?? 1);
      setEditingId(null);
      setShowNew(true);
      toast.success("Rascunho restaurado.");
    } catch {
      toast.error("Não foi possível restaurar o rascunho.");
    }
  };

  const limparRascunho = () => {
    if (!draftKey || typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(draftKey);
    } catch {}
    setHasDraft(false);
    setDraftSavedAt(null);
    toast.success("Rascunho descartado.");
  };

  const startEdit = (o: OrcamentoRow) => {
    if (o.status !== "customizado_pendente") {
      toast.error("Não é mais possível editar este orçamento.");
      return;
    }
    setEditingId(o.id);
    setSelServiceId(o.service_id ?? "");
    setDescricao(o.descricao ?? "");
    const mats = orcMats[o.id] ?? [];
    const p: Record<string, number> = {};
    mats.forEach((m) => {
      if (m.material_id) p[m.material_id] = Number(m.quantidade);
    });
    setPicked(p);
    setFotos((((o as any).fotos_problema as string[]) ?? []));
    setStep(1);
    setShowNew(true);
  };

  const goToStep2 = () => {
    if (!selServico) {
      toast.error("Selecione um serviço para continuar.");
      return;
    }
    if (selServico.preco_min == null || selServico.preco_max == null) {
      toast.error("Este serviço ainda não tem preço tabelado. Escolha outro.");
      return;
    }
    if (Number(selServico.preco_min) > Number(selServico.preco_max)) {
      toast.error("Range de preço inválido para este serviço.");
      return;
    }
    setStep(2);
  };

  const handleNew = async () => {
    if (!selServico) return;
    const payload = {
      serviceId: selServico.id,
      serviceName: selServico.nome,
      descricao: descricao.trim() || undefined,
      materiais: Object.entries(picked).map(([materialId, quantidade]) => ({
        materialId,
        quantidade,
      })),
    };
    const parsed = novoSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await editar({
          data: {
            orcamentoId: editingId,
            descricao: payload.descricao,
            materiais: payload.materiais,
          },
        });
        await supabase.from("orcamentos").update({ fotos_problema: fotos } as any).eq("id", editingId);
        toast.success("Orçamento atualizado.");
      } else {
        const { data: novoOrcamento, error: orcamentoError } = await supabase
          .from("orcamentos")
          .insert({
            cliente_id: user.id,
            service_id: payload.serviceId,
            service_name: payload.serviceName,
            descricao: payload.descricao ?? null,
            fotos_problema: fotos,
          } as any)
          .select("id")
          .single();

        if (orcamentoError) throw orcamentoError;

        const novoId = novoOrcamento?.id;
        if (novoId && payload.materiais.length > 0) {
          const materialIds = payload.materiais.map((m) => m.materialId);
          const { data: materiaisRows, error: materiaisError } = await supabase
            .from("materiais")
            .select("id, nome, unidade, preco_atual")
            .in("id", materialIds);

          if (materiaisError) throw materiaisError;

          const materialItems = payload.materiais
            .map((m) => {
              const material = materiaisRows?.find((row) => row.id === m.materialId);
              if (!material) return null;
              return {
                orcamento_id: novoId,
                material_id: material.id,
                nome_snapshot: material.nome,
                unidade_snapshot: material.unidade,
                quantidade: m.quantidade,
                preco_unitario: Number(material.preco_atual),
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

          if (materialItems.length > 0) {
            const { error: itensError } = await supabase.from("orcamento_materiais").insert(materialItems);
            if (itensError) throw itensError;
          }
        }
        toast.success("Solicitação enviada! Aguarde a confirmação do profissional.");
        queryClient.invalidateQueries({ queryKey: ["cliente"] });
        // limpa rascunho após envio bem-sucedido
        if (draftKey && typeof window !== "undefined") {
          try {
            window.localStorage.removeItem(draftKey);
          } catch {}
          setHasDraft(false);
          setDraftSavedAt(null);
        }
      }
      resetForm();
      navigate({ to: "/cliente", search: { tab: "pedidos" } });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Orçamentos</h1>
          <p className="text-muted-foreground mt-1">Preço tabelado e materiais opcionais.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasDraft && !showNew && (
            <>
              <Button
                onClick={carregarRascunho}
                variant="outline"
                className="rounded-full gap-2"
              >
                <Save className="h-4 w-4" /> Retomar rascunho
              </Button>
              <Button
                onClick={limparRascunho}
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Descartar rascunho"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            onClick={() => {
              if (showNew) resetForm();
              else {
                setStep(1);
                setShowNew(true);
              }
            }}
            className="rounded-full bg-brand text-brand-foreground gap-2"
          >
            <Plus className="h-4 w-4" /> {showNew ? "Cancelar" : "Nova solicitação"}
          </Button>
        </div>
      </div>

      {showNew && (
        <div className="bg-white rounded-2xl border border-border p-6 mb-6 shadow-soft space-y-5">
          {editingId && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Editando solicitação enviada — alterações são possíveis até o profissional responder.
            </div>
          )}
          {!editingId && draftSavedAt && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Save className="h-3 w-3" /> Rascunho salvo automaticamente
            </p>
          )}
          {/* Stepper */}
          <ol className="flex items-center gap-2 text-xs font-semibold">
            {[
              { n: 1, label: "Serviço", icon: Wrench },
              { n: 2, label: "Materiais", icon: Package },
              { n: 3, label: "Confirmar", icon: ClipboardCheck },
            ].map((s, i) => {
              const Icon = s.icon;
              const active = step === s.n;
              const done = step > s.n;
              // Pode navegar para passos já visitados/concluídos, ou para o atual.
              // Avançar exige Serviço selecionado.
              const canGo = s.n <= step || (s.n === 2 && !!selServiceId) || (s.n === 3 && !!selServiceId);
              return (
                <li key={s.n} className="flex items-center gap-2 flex-1">
                  <button
                    type="button"
                    onClick={() => canGo && setStep(s.n as 1 | 2 | 3)}
                    disabled={!canGo}
                    aria-current={active ? "step" : undefined}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-colors ${
                      active
                        ? "bg-brand text-brand-foreground border-brand"
                        : done
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          : "bg-slate-50 text-muted-foreground border-border hover:bg-slate-100"
                    } ${canGo ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>
                      {s.n}. {s.label}
                    </span>
                  </button>
                  {i < 2 && <div className="flex-1 h-px bg-border" />}
                 </li>
               );
             })}
          </ol>

          {/* Resumo dinâmico — atualiza com serviço selecionado e materiais */}
          {selServico && selServico.preco_min != null && selServico.preco_max != null && (() => {
            const min = Number(selServico.preco_min);
            const max = Number(selServico.preco_max);
            const media = (min + max) / 2;
            const horas = Math.max(0.5, Math.min(8, media / 80));
            const tempo =
              horas < 1 ? "≈ 30 min"
              : horas < 1.5 ? "≈ 1 h"
              : horas < 5 ? `≈ ${Math.round(horas * 2) / 2} h`
              : `≈ ${Math.round(horas)} h`;
            const totalMin = min + subtotalMat;
            const totalMax = max + subtotalMat;
            const qtdMat = Object.keys(picked).length;
            return (
              <div className="rounded-2xl border border-border bg-card px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Resumo
                    </p>
                    <p className="mt-1 font-semibold text-foreground truncate">{selServico.nome}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {qtdMat > 0 ? `${qtdMat} material(is)` : "Sem materiais"} · {tempo}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Total estimado
                    </p>
                    <p className="text-lg font-semibold text-foreground whitespace-nowrap tabular-nums">
                      {min === max ? brl(totalMin) : `${brl(totalMin)} – ${brl(totalMax)}`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Step 1: Serviço */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase font-bold text-muted-foreground">
                  Serviço <span className="text-red-500">*</span>
                </label>
                <select
                  value={selServiceId}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === selServiceId) return;
                    setSelServiceId(next);
                    setPicked({}); // materiais sugeridos mudam ao trocar de serviço
                  }}
                  className="w-full mt-1 h-12 px-3 rounded-xl border border-border bg-slate-50"
                >
                  <option value="">Selecione um serviço…</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                      {s.preco_min != null && s.preco_max != null
                        ? ` — ${brl(Number(s.preco_min))} a ${brl(Number(s.preco_max))}`
                        : ""}
                    </option>
                  ))}
                </select>
                {selServico && selServico.preco_min != null && selServico.preco_max != null && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Range tabelado:{" "}
                    <span className="font-semibold text-foreground">
                      {brl(Number(selServico.preco_min))} a {brl(Number(selServico.preco_max))}
                    </span>
                    . O profissional confirmará o valor exato dentro desse range.
                  </p>
                )}
                {selServico && (selServico.preco_min == null || selServico.preco_max == null) && (
                  <p className="text-xs text-amber-700 mt-2">
                    Este serviço ainda não tem preço tabelado. Escolha outro item.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs uppercase font-bold text-muted-foreground">
                  Descrição (opcional)
                </label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  maxLength={2000}
                  placeholder="Ex.: 2 prateleiras na sala, parede de drywall…"
                  rows={3}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-border bg-slate-50"
                />
                <p className="text-[11px] text-muted-foreground mt-1 text-right">
                  {descricao.length}/2000
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={goToStep2}
                  disabled={!selServiceId}
                  className="rounded-full bg-foreground text-background font-bold gap-2"
                >
                  Continuar <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          {/* Step 2: Materiais */}
          {step === 2 && (
            <div className="space-y-4">
              {sugeridos.length > 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-brand" />
                    <h4 className="font-bold text-sm">Materiais opcionais</h4>
                    <span className="text-xs text-muted-foreground">(taxa adicional)</span>
                  </div>
                  <ul className="space-y-2">
                    {sugeridos.map((m) => {
                      const sm = serviceMats.find(
                        (s) => s.service_id === selServiceId && s.material_id === m.id,
                      );
                      const qtyDefault = Number(sm?.quantidade_sugerida ?? 1);
                      const checked = m.id in picked;
                      const qty = picked[m.id] ?? qtyDefault;
                      return (
                        <li
                          key={m.id}
                          className="flex items-center gap-3 bg-white rounded-xl p-3 border border-border"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePick(m.id, qtyDefault)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{m.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {brl(Number(m.preco_atual))} / {m.unidade}
                              {m.preco_fonte === "marketplace" && " · marketplace"}
                            </p>
                          </div>
                          {checked && (
                            <input
                              type="number"
                              min={1}
                              max={1000}
                              value={qty}
                              onChange={(e) => {
                                const n = Math.min(1000, Math.max(1, Number(e.target.value) || 1));
                                setPicked((p) => ({ ...p, [m.id]: n }));
                              }}
                              className="w-16 h-9 px-2 rounded-lg border border-border text-sm text-right"
                            />
                          )}
                          {checked && (
                            <span className="text-sm font-bold tabular-nums w-20 text-right">
                              {brl(Number(m.preco_atual) * qty)}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {Object.keys(picked).length > 0 && (
                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-border text-sm">
                      <span className="text-muted-foreground">Subtotal materiais</span>
                      <span className="font-bold">{brl(subtotalMat)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 border border-border p-6 text-center text-sm text-muted-foreground">
                  Nenhum material sugerido para este serviço. Você pode seguir para a confirmação.
                </div>
              )}

              {user && (
                <div className="rounded-2xl bg-slate-50 border border-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-brand" />
                    <h4 className="font-bold text-sm">Fotos do problema</h4>
                    <span className="text-xs text-muted-foreground">(opcional, ajuda o profissional)</span>
                  </div>
                  <PhotoUploader
                    userId={user.id}
                    pathPrefix="problema"
                    value={fotos}
                    onChange={setFotos}
                    max={5}
                    label="tirar ou anexar"
                  />
                </div>
              )}


              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="rounded-full gap-2"
                >
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="rounded-full bg-foreground text-background font-bold gap-2"
                >
                  Continuar <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirmar */}
          {step === 3 && selServico && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {descricao.trim() && (
                  <div className="px-5 py-4 border-b border-border">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Descrição
                    </p>
                    <p className="mt-1 text-sm text-foreground whitespace-pre-line">{descricao}</p>
                  </div>
                )}

                {Object.keys(picked).length > 0 && (
                  <div className="px-5 py-4 border-b border-border">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Materiais ({Object.keys(picked).length})
                    </p>
                    <ul className="mt-2 text-sm divide-y divide-border/60">
                      {Object.entries(picked).map(([id, qty]) => {
                        const m = materiais.find((x) => x.id === id);
                        if (!m) return null;
                        return (
                          <li key={id} className="flex justify-between py-1.5">
                            <span className="text-foreground">
                              {m.nome}
                              <span className="text-muted-foreground"> · {qty} {m.unidade}</span>
                            </span>
                            <span className="font-medium tabular-nums text-foreground">
                              {brl(Number(m.preco_atual) * qty)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {selServico.preco_min != null && selServico.preco_max != null && (
                  <div className="px-5 py-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mão de obra</span>
                      <span className="tabular-nums">
                        {brl(Number(selServico.preco_min))} – {brl(Number(selServico.preco_max))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Materiais</span>
                      <span className="tabular-nums">{brl(subtotalMat)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-3 mt-1 border-t border-border">
                      <span className="font-semibold">Total estimado</span>
                      <span className="text-base font-semibold tabular-nums">
                        {brl(Number(selServico.preco_min) + subtotalMat)} –{" "}
                        {brl(Number(selServico.preco_max) + subtotalMat)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground pt-1 leading-relaxed">
                      O valor final será confirmado pelo profissional após avaliação no local.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="rounded-full gap-2"
                  disabled={saving}
                >
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button
                  onClick={handleNew}
                  disabled={saving}
                  className="bg-foreground text-background rounded-full font-bold gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ClipboardCheck className="h-4 w-4" /> Enviar solicitação
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
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
        {list.map((o) => {
          const s = statusLabel[o.status] ?? { label: o.status, cls: "bg-slate-100 text-slate-700" };
          const podeAprovar = o.status === "enviado" || o.status === "fixo_auto";
          const mats = orcMats[o.id] ?? [];
          const isOpen = !!expanded[o.id];
          return (
            <div key={o.id} className="bg-white rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-bold text-lg">{o.service_name}</h3>
                  {o.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">{o.descricao}</p>
                  )}
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${s.cls}`}>
                  {s.label}
                </span>
              </div>

              {o.valor != null && (
                <div className="mb-2">
                  <p className="text-2xl font-bold text-foreground">{brl(Number(o.valor))}</p>
                  {(Number(o.valor_servico ?? 0) > 0 || Number(o.taxa_material) > 0) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Mão de obra {brl(Number(o.valor_servico ?? 0))} · Materiais{" "}
                      {brl(Number(o.taxa_material))}
                    </p>
                  )}
                </div>
              )}

              {mats.length > 0 && (
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [o.id]: !p[o.id] }))}
                  className="text-xs text-brand font-semibold flex items-center gap-1 mb-2"
                >
                  {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {mats.length} {mats.length === 1 ? "material" : "materiais"}
                </button>
              )}
              {isOpen && mats.length > 0 && (
                <ul className="text-xs space-y-1 bg-slate-50 rounded-xl p-3 mb-3">
                  {mats.map((m) => (
                    <li key={m.id} className="flex justify-between">
                      <span>
                        {m.nome_snapshot}{" "}
                        <span className="text-muted-foreground">
                          × {Number(m.quantidade)} {m.unidade_snapshot}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums">{brl(Number(m.subtotal))}</span>
                    </li>
                  ))}
                </ul>
              )}

              {o.observacoes_profissional && (
                <p className="text-sm italic text-muted-foreground mb-3">
                  "{o.observacoes_profissional}"
                </p>
              )}
              {o.auto_aprovado && (
                <p className="text-xs text-green-700 font-medium mb-3 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Aprovado automaticamente (cliente recorrente)
                </p>
              )}

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                {podeAprovar && (
                  <>
                    <Button
                      onClick={() => decidir({ data: { orcamentoId: o.id, decisao: "aprovado" } })}
                      className="bg-green-600 hover:bg-green-700 text-white rounded-full gap-2 font-bold"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Aprovar
                    </Button>
                    <Button
                      onClick={() => decidir({ data: { orcamentoId: o.id, decisao: "recusado" } })}
                      variant="outline"
                      className="rounded-full gap-2"
                    >
                      <XCircle className="h-4 w-4" /> Recusar
                    </Button>
                  </>
                )}
                {o.status === "aprovado" && o.valor && (
                  <Button asChild className="bg-brand text-brand-foreground rounded-full font-bold">
                    <Link to="/checkout" search={{ service: o.service_name, price: Number(o.valor), step: 1 } as any}>
                      Pagar agora
                    </Link>
                  </Button>
                )}
                {o.status === "customizado_pendente" && (
                  <>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 flex-1">
                      <Clock className="h-4 w-4" /> Um profissional vai analisar e enviar o valor.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => startEdit(o)}
                      className="rounded-full gap-2"
                    >
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
