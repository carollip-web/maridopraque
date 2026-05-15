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
import { aceitarProposta, decidirOrcamento, editarOrcamento } from "@/lib/orcamentos.functions";
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
  Send,
  User,
  Users,
  Calendar,
  Sun,
  Moon,
  Sunrise,
  Coffee,
  Info,
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
      {
        name: "description",
        content:
          "Solicite orçamento online em 5 etapas: escolha o serviço, atendimento, agenda, materiais opcionais e confirme.",
      },
      { property: "og:title", content: "Orçamento online — Marido pra Quê?" },
      {
        property: "og:description",
        content: "Preço tabelado, atendimento, agenda e acompanhamento em tempo real.",
      },
    ],
  }),
  errorComponent: ({ error }) => {
    return (
      <div className="p-12 text-center space-y-4 max-w-2xl mx-auto">
        <div className="bg-red-50 text-red-600 p-6 rounded-3xl border border-red-100">
          <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-black tracking-tight mb-2">Ops! Algo deu errado.</h2>
          <p className="text-sm font-medium opacity-80 mb-6">Ocorreu um erro inesperado ao carregar seus orçamentos.</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="rounded-full border-red-200 hover:bg-red-100">
            Tentar novamente
          </Button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <div className="text-left mt-8 p-4 bg-slate-900 text-slate-300 rounded-2xl overflow-auto text-[10px] font-mono leading-relaxed shadow-xl border border-slate-800">
            <p className="text-red-400 font-bold mb-2">DEV ERROR LOG:</p>
            {error.message}
            {"\n\n"}
            {error.stack}
          </div>
        )}
      </div>
    );
  },
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
  tipo_atendimento: string | null;
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
  customizado_pendente: { label: "Aguardando proposta", cls: "bg-amber-50 text-amber-700" },
  fixo_auto: { label: "Aguardando aprovação", cls: "bg-blue-50 text-blue-700" },
  enviado: { label: "Aguardando aprovação", cls: "bg-blue-50 text-blue-700" },
  aprovado: { label: "Aguardando pagamento", cls: "bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm" },
  recusado: { label: "Recusado", cls: "bg-red-50 text-red-700" },
  pago: { label: "Pagamento confirmado", cls: "bg-green-50 text-green-700" },
  cancelado: { label: "Cancelado", cls: "bg-slate-50 text-slate-700" },
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
  const [tipoAtendimento, setTipoAtendimento] = useState<string>("");
  const [dataPreferida, setDataPreferida] = useState<string>("");
  const [periodoPreferido, setPeriodoPreferido] = useState<string>("manha");
  const [horarioPreferido, setHorarioPreferido] = useState<string>("");
  const [flexibilidadeAgenda, setFlexibilidadeAgenda] = useState<string>("flexivel");
  const [picked, setPicked] = useState<Record<string, number>>({}); // materialId -> qty
  const [fotos, setFotos] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  const draftKey = user ? `orc-draft-${user.id}` : null;

  const editar = useServerFn(editarOrcamento);
  const decidir = useServerFn(decidirOrcamento);
  const aceitarProp = useServerFn(aceitarProposta);

  const [propostas, setPropostas] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const refresh = async () => {
    if (!user) return;
    try {
      const { data, error: orcError } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("cliente_id", user.id)
        .order("created_at", { ascending: false });
      
      if (orcError) {
        console.error("[orcamentos.refresh] erro ao buscar orçamentos", orcError);
        toast.error("Não foi possível carregar seus orçamentos.");
        return;
      }

      const rows = (data as any ?? []) as OrcamentoRow[];
      setList(rows);

      if (rows.length > 0) {
        const { data: mats, error: matsError } = await supabase
          .from("orcamento_materiais")
          .select("*")
          .in(
            "orcamento_id",
            rows.map((r) => r.id),
          );
        
        if (matsError) console.error("[orcamentos.refresh] erro ao buscar materiais", matsError);

        const grouped: Record<string, OrcMaterial[]> = {};
        (mats ?? []).forEach((m: any) => {
          (grouped[m.orcamento_id] ||= []).push(m as OrcMaterial);
        });
        setOrcMats(grouped);

        const { data: props, error: propsError } = await supabase
          .from("propostas")
          .select("*")
          .in(
            "orcamento_id",
            rows.map((r) => r.id),
          );
        
        if (propsError) console.error("[orcamentos.refresh] erro ao buscar propostas", propsError);
        
        const pRows = props ?? [];
        const profIds = Array.from(new Set(pRows.map(p => p.profissional_id).filter(Boolean)));
        
        const profsMap: Record<string, string> = {};
        if (profIds.length > 0) {
          const { data: profs, error: profsError } = await supabase
            .from("profiles")
            .select("id, nome")
            .in("id", profIds);
          
          if (profsError) console.error("[orcamentos.refresh] erro ao buscar perfis", profsError);

          (profs ?? []).forEach(pf => {
            profsMap[pf.id] = pf.nome;
          });
        }

        const propGrouped: Record<string, any[]> = {};
        pRows.forEach((p: any) => {
          const profNome = profsMap[p.profissional_id] || "Profissional";
          (propGrouped[p.orcamento_id] ||= []).push({ ...p, profNome });
        });
        setPropostas(propGrouped);
      }
    } catch (err) {
      console.error("[orcamentos.refresh] erro inesperado", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    Promise.all([
      supabase
        .from("services_catalog")
        .select("id, nome, categoria, preco_min, preco_max")
        .eq("ativo", true),
      supabase
        .from("materiais")
        .select("id, nome, unidade, preco_atual, preco_fonte")
        .eq("ativo", true),
      supabase.from("service_materiais").select("*"),
    ]).then(([s, m, sm]) => {
      setServicos((s.data ?? []) as Servico[]);
      setMateriais((m.data ?? []).map((x: any) => ({ ...x, preco_atual: Number(x.preco_atual) })));
      setServiceMats((sm.data ?? []) as ServiceMaterial[]);
    });

    const ch = supabase
      .channel("cli-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orcamentos", filter: `cliente_id=eq.${user.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "propostas"
        },
        () => {
          refresh();
        }
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
      const norm = (t: string) =>
        t
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();
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
    const norm = (t: string) =>
      t
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    let m: Servico | undefined;
    if (search.serviceId) m = servicos.find((x) => x.id === search.serviceId);
    if (!m && search.serviceName) {
      const target = norm(search.serviceName);
      const pool = search.categoria
        ? servicos.filter((x) => norm(x.categoria) === norm(search.categoria!))
        : servicos;
      m =
        pool.find((x) => norm(x.nome) === target) ||
        pool.find((x) => norm(x.nome).includes(target) || target.includes(norm(x.nome)));
    }
    if (m) setSelServiceId(m.id);
  }, [
    step,
    selServiceId,
    showNew,
    editingId,
    servicos,
    search.serviceId,
    search.serviceName,
    search.categoria,
  ]);

  const selServico = servicos.find((s) => s.id === selServiceId);
  const sugeridos = useMemo(() => {
    if (!selServiceId) return [] as Material[];
    const ids = serviceMats
      .filter((sm) => sm.service_id === selServiceId)
      .map((sm) => sm.material_id);
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
    tipoAtendimento: z.string().min(1, "Selecione o tipo de atendimento."),
    dataPreferida: z.string().min(1, "Selecione a data desejada."),
    periodoPreferido: z.string().min(1, "Selecione o período."),
    horarioPreferido: z.string().optional(),
    flexibilidadeAgenda: z.string().optional(),
    materiais: z
      .array(
        z.object({ materialId: z.string().uuid(), quantidade: z.number().int().min(1).max(1000) }),
      )
      .max(50, "Máximo de 50 itens de material."),
  });

  const resetForm = () => {
    setSelServiceId("");
    setDescricao("");
    setTipoAtendimento("");
    setDataPreferida("");
    setPeriodoPreferido("manha");
    setHorarioPreferido("");
    setFlexibilidadeAgenda("flexivel");
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
          JSON.stringify({ selServiceId, descricao, tipoAtendimento, dataPreferida, periodoPreferido, horarioPreferido, flexibilidadeAgenda, picked, step, savedAt: Date.now() }),
        );
        setDraftSavedAt(Date.now());
        setHasDraft(true);
      } catch {}
    }, 500);
    return () => window.clearTimeout(t);
  }, [draftKey, showNew, editingId, selServiceId, descricao, tipoAtendimento, dataPreferida, periodoPreferido, horarioPreferido, flexibilidadeAgenda, picked, step]);

  const carregarRascunho = () => {
    if (!draftKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        selServiceId?: string;
        descricao?: string;
        tipoAtendimento?: string;
        dataPreferida?: string;
        periodoPreferido?: string;
        horarioPreferido?: string;
        flexibilidadeAgenda?: string;
        picked?: Record<string, number>;
        step?: 1 | 2 | 3 | 4 | 5;
      };
      setSelServiceId(d.selServiceId ?? "");
      setDescricao(d.descricao ?? "");
      setTipoAtendimento(d.tipoAtendimento ?? "");
      setDataPreferida(d.dataPreferida ?? "");
      setPeriodoPreferido(d.periodoPreferido ?? "manha");
      setHorarioPreferido(d.horarioPreferido ?? "");
      setFlexibilidadeAgenda(d.flexibilidadeAgenda ?? "flexivel");
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
    setFotos(((o as any).fotos_problema as string[]) ?? []);
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
    if (!user) {
      toast.error("Faça login para enviar uma solicitação.");
      return;
    }
    const userId = user.id;
    const payload = {
      serviceId: selServico.id,
      serviceName: selServico.nome,
      descricao: descricao.trim() || undefined,
      tipoAtendimento,
      dataPreferida,
      periodoPreferido,
      horarioPreferido: horarioPreferido || undefined,
      flexibilidadeAgenda,
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
        await supabase
          .from("orcamentos")
          .update({ fotos_problema: fotos } as any)
          .eq("id", editingId);
        toast.success("Orçamento atualizado.");
      } else {
        const insertPayload = {
          cliente_id: userId,
          service_id: payload.serviceId,
          service_name: payload.serviceName,
          descricao: payload.descricao ?? null,
          tipo_atendimento: payload.tipoAtendimento || null,
          fotos_problema: Array.isArray(fotos) ? fotos : [],
        };

        const { data: novoOrcamento, error: orcamentoError } = await supabase
          .from("orcamentos")
          .insert(insertPayload as any)
          .select("id")
          .single();

        if (orcamentoError) {
          console.error("[orcamentos.handleNew] erro ao criar orçamento", {
            code: orcamentoError.code,
            message: orcamentoError.message,
            details: orcamentoError.details,
            hint: orcamentoError.hint,
            payload: insertPayload,
          });
          toast.error("Não foi possível criar o pedido", {
            description: `${orcamentoError.code || ""} ${orcamentoError.message || ""}`.trim(),
          });
          throw orcamentoError;
        }

        const novoId = novoOrcamento?.id;
        if (novoId) {
          // Tentativa secundária de salvar a agenda (não bloqueia o pedido se o schema cache estiver desatualizado)
          const agendaPayload = {
            data_preferida: payload.dataPreferida || null,
            periodo_preferido: payload.periodoPreferido || null,
            horario_preferido: payload.horarioPreferido || null,
            flexibilidade_agenda: payload.flexibilidadeAgenda || "flexivel",
          };

          const { error: agendaError } = await supabase
            .from("orcamentos")
            .update(agendaPayload as any)
            .eq("id", novoId);

          if (agendaError) {
            console.warn("[orcamentos] agenda não salva por schema cache", agendaError);
            if (agendaError.code === "PGRST204" || agendaError.message.includes("data_preferida")) {
              toast.info("Pedido criado! A preferência de agenda será sincronizada em instantes.");
            }
          }

          if (payload.materiais.length > 0) {
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
            const { error: itensError } = await supabase
              .from("orcamento_materiais")
              .insert(materialItems);
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
      setShowNew(false); // Volta para a tela de acompanhamento
      refresh();
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
    <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Orçamentos</h1>
          <p className="text-muted-foreground mt-1">Preço tabelado e materiais opcionais.</p>
        </div>
        <div className="flex items-center gap-3">
          {hasDraft && !showNew && (
            <div className="flex items-center bg-slate-50 p-1 rounded-full border border-slate-100">
              <Button onClick={carregarRascunho} variant="ghost" size="sm" className="rounded-full text-xs gap-2 font-bold text-slate-600">
                <Save className="h-3.5 w-3.5" /> Retomar rascunho
              </Button>
              <Button
                onClick={limparRascunho}
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
              if (showNew) resetForm();
              else {
                setStep(1);
                setShowNew(true);
              }
            }}
            variant={showNew ? "ghost" : "default"}
            size={showNew ? "sm" : "default"}
            className={`rounded-full gap-2 font-bold ${showNew ? "text-red-500 hover:bg-red-50" : "bg-brand text-brand-foreground shadow-md"}`}
          >
            {showNew ? <XCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showNew ? "Cancelar pedido" : "Nova solicitação"}
          </Button>
        </div>
      </div>

      {showNew && (
        <div className="bg-white rounded-2xl border border-border p-6 mb-6 shadow-soft space-y-5">
          {editingId && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Editando solicitação enviada — alterações são possíveis
              até o profissional responder.
            </div>
          )}
          {!editingId && draftSavedAt && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Save className="h-3 w-3" /> Rascunho salvo automaticamente
            </p>
          )}
          <ol className="flex flex-wrap items-center justify-center gap-y-3 gap-x-2 md:gap-x-4 py-2 border-b border-slate-50 pb-8">
            {[
              { n: 1, label: "Serviço", icon: Wrench },
              { n: 2, label: "Atendimento", icon: User },
              { n: 3, label: "Agenda", icon: Calendar },
              { n: 4, label: "Materiais", icon: Package },
              { n: 5, label: "Confirmar", icon: ClipboardCheck },
            ].map((s, i) => {
              const Icon = s.icon;
              const active = step === s.n;
              const done = step > s.n;
              const canGo =
                s.n <= step || (s.n > step && !!selServiceId);
              return (
                <li key={s.n} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => canGo && setStep(s.n as 1 | 2 | 3 | 4 | 5)}
                    disabled={!canGo}
                    aria-current={active ? "step" : undefined}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full border transition-all duration-300 ${
                      active
                        ? "bg-brand text-brand-foreground border-brand shadow-md scale-105"
                        : done
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          : "bg-slate-50 text-muted-foreground border-border hover:bg-slate-100"
                    } ${canGo ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? "animate-pulse" : ""}`} />
                    <span className="text-[11px] md:text-xs font-bold whitespace-nowrap">
                      {s.n}. {s.label}
                    </span>
                  </button>
                  {i < 4 && <div className="hidden lg:block w-3 md:w-6 h-px bg-slate-200" />}
                </li>
              );
            })}
          </ol>

          {/* Resumo dinâmico — atualiza com serviço selecionado e materiais */}
          {selServico &&
            selServico.preco_min != null &&
            selServico.preco_max != null &&
            (() => {
              const min = Number(selServico.preco_min);
              const max = Number(selServico.preco_max);
              const media = (min + max) / 2;
              const horas = Math.max(0.5, Math.min(8, media / 80));
              const tempo =
                horas < 1
                  ? "≈ 30 min"
                  : horas < 1.5
                    ? "≈ 1 h"
                    : horas < 5
                      ? `≈ ${Math.round(horas * 2) / 2} h`
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
                      <p className="mt-1 font-semibold text-foreground truncate">
                        {selServico.nome}
                      </p>
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
                  onClick={() => setStep(2)}
                  disabled={!selServiceId}
                  className="rounded-full bg-foreground text-background font-bold gap-2"
                >
                  Continuar <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Atendimento */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-slate-800">Escolha o tipo de atendimento</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione a opção que deixa você mais confortável para receber o serviço.
                </p>
              </div>

              <div className="grid gap-4">
                {[
                  {
                    id: "mulher",
                    title: "Profissional mulher",
                    desc: "Prefere ser atendida por uma profissional mulher? Vamos verificar a disponibilidade na sua região. Caso não haja agenda disponível, você ainda poderá contar com a opção de apoio feminino durante a visita.",
                    icon: <User className="h-5 w-5" />,
                    color: "bg-pink-50 text-pink-600 border-pink-100",
                    activeColor: "ring-pink-500 bg-pink-50/50 border-pink-200",
                  },
                  {
                    id: "homem",
                    title: "Profissional homem",
                    desc: "Atendimento com profissional homem selecionado pela habilidade técnica, postura e comportamento. Indicado para serviços que exigem força física, instalações complexas ou manutenções mais pesadas.",
                    icon: <User className="h-5 w-5" />,
                    color: "bg-blue-50 text-blue-600 border-blue-100",
                    activeColor: "ring-blue-500 bg-blue-50/50 border-blue-200",
                  },
                  {
                    id: "homem_com_apoio_feminino",
                    title: "Profissional + apoio feminino",
                    desc: "Nossa modalidade mais escolhida. O técnico realiza o serviço enquanto uma mulher de apoio acompanha a visita, auxiliando na organização e trazendo mais conforto e segurança dentro da sua casa.",
                    icon: <Users className="h-5 w-5" />,
                    color: "bg-emerald-50 text-emerald-600 border-emerald-100",
                    activeColor: "ring-emerald-500 bg-emerald-50/50 border-emerald-200",
                  },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`relative flex flex-col p-5 rounded-3xl border-2 cursor-pointer transition-all hover:shadow-md ${
                      tipoAtendimento === opt.id
                        ? `ring-2 ${opt.activeColor}`
                        : "border-slate-100 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipoAtendimento"
                      value={opt.id}
                      checked={tipoAtendimento === opt.id}
                      onChange={(e) => setTipoAtendimento(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${opt.color}`}>
                        {opt.icon}
                      </div>
                      <span className="font-bold text-slate-800">{opt.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-13">
                      {opt.desc}
                    </p>
                  </label>
                ))}
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="rounded-full gap-2">
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!tipoAtendimento}
                  className="rounded-full bg-foreground text-background font-bold gap-2"
                >
                  Continuar <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Agenda */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-slate-800">Quando você prefere receber o serviço?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Vamos buscar profissionais disponíveis na sua região e no melhor horário para você.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3 w-3" /> Data desejada
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={dataPreferida}
                    onChange={(e) => setDataPreferida(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-slate-50 focus:ring-2 focus:ring-brand/20 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3" /> Flexibilidade
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "flexivel", label: "Flexível" },
                      { id: "exato", label: "Preciso desse dia/hora" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setFlexibilidadeAgenda(opt.id)}
                        className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                          flexibilidadeAgenda === opt.id
                            ? "bg-brand/10 border-brand text-brand shadow-sm"
                            : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs uppercase font-bold text-muted-foreground">Período de preferência</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: "manha", label: "Manhã", icon: Sunrise, color: "text-amber-500 bg-amber-50" },
                    { id: "tarde", label: "Tarde", icon: Sun, color: "text-orange-500 bg-orange-50" },
                    { id: "noite", label: "Noite", icon: Moon, color: "text-indigo-500 bg-indigo-50" },
                    { id: "horario_especifico", label: "Hora exata", icon: Clock, color: "text-brand bg-brand-soft" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPeriodoPreferido(p.id)}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                        periodoPreferido === p.id
                          ? "border-brand ring-2 ring-brand/10 bg-white shadow-md scale-[1.02]"
                          : "border-slate-100 bg-slate-50/50 grayscale hover:grayscale-0 hover:border-slate-200"
                      }`}
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${p.color}`}>
                        <p.icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {periodoPreferido === "horario_especifico" && (
                <div className="space-y-2 animate-in zoom-in-95 duration-200">
                  <label className="text-xs uppercase font-bold text-muted-foreground">Selecione o horário</label>
                  <input
                    type="time"
                    value={horarioPreferido}
                    onChange={(e) => setHorarioPreferido(e.target.value)}
                    className="w-full max-w-[200px] px-4 py-3 rounded-2xl border border-border bg-slate-50 focus:ring-2 focus:ring-brand/20 outline-none transition-all"
                  />
                </div>
              )}

              <div className="flex justify-between gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(2)} className="rounded-full gap-2">
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  disabled={!dataPreferida || (periodoPreferido === "horario_especifico" && !horarioPreferido)}
                  className="rounded-full bg-foreground text-background font-bold gap-2"
                >
                  Continuar <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Materiais */}
          {step === 4 && (
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
                    <span className="text-xs text-muted-foreground">
                      (opcional, ajuda o profissional)
                    </span>
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
                <Button variant="outline" onClick={() => setStep(3)} className="rounded-full gap-2">
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button
                  onClick={() => setStep(5)}
                  className="rounded-full bg-foreground text-background font-bold gap-2"
                >
                  Continuar <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Confirmar */}
          {step === 5 && selServico && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Revise sua solicitação</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Confira os detalhes abaixo antes de enviar para os profissionais.
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-5">
                {/* Coluna Esquerda: Detalhes */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                    {/* Resumo do Serviço */}
                    <div className="px-6 py-5 border-b border-slate-50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                        O que será feito
                      </p>
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-brand/5 flex items-center justify-center text-brand shrink-0">
                          <Wrench className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 leading-tight">{selServico.nome}</h4>
                          {descricao.trim() && (
                            <p className="mt-2 text-xs text-muted-foreground line-clamp-3 italic">
                              "{descricao}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Atendimento e Agenda em grid */}
                    <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-50">
                      <div className="px-6 py-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                          Atendimento
                        </p>
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs ${
                            tipoAtendimento === "mulher" ? "bg-pink-100 text-pink-600" :
                            tipoAtendimento === "homem" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                          }`}>
                            {tipoAtendimento === "homem_com_apoio_feminino" ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                          </div>
                          <span className="text-xs font-bold text-slate-700">
                            {tipoAtendimento === "mulher" ? "Profissional mulher" :
                             tipoAtendimento === "homem" ? "Profissional homem" : "Profissional + apoio feminino"}
                          </span>
                        </div>
                      </div>
                      <div className="px-6 py-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                          Agenda Desejada
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl bg-brand-soft flex items-center justify-center text-brand">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-700">
                              {dataPreferida ? new Date(dataPreferida + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : "---"}
                              {" · "}
                              <span className="text-muted-foreground">
                                {periodoPreferido === 'manha' && 'Manhã'}
                                {periodoPreferido === 'tarde' && 'Tarde'}
                                {periodoPreferido === 'noite' && 'Noite'}
                                {periodoPreferido === 'horario_especifico' && horarioPreferido}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Materiais se houver */}
                    {Object.keys(picked).length > 0 && (
                      <div className="px-6 py-5 border-t border-slate-50 bg-slate-50/30">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                          Materiais Selecionados ({Object.keys(picked).length})
                        </p>
                        <ul className="space-y-2">
                          {Object.entries(picked).slice(0, 3).map(([id, qty]) => {
                            const m = materiais.find((x) => x.id === id);
                            if (!m) return null;
                            return (
                              <li key={id} className="flex justify-between text-xs">
                                <span className="text-slate-600 truncate mr-4">
                                  {m.nome} <span className="opacity-50">· {qty} {m.unidade}</span>
                                </span>
                                <span className="font-bold tabular-nums text-slate-800">
                                  {brl(Number(m.preco_atual) * qty)}
                                </span>
                              </li>
                            );
                          })}
                          {Object.keys(picked).length > 3 && (
                            <li className="text-[10px] text-brand font-bold">
                              + {Object.keys(picked).length - 3} outros itens
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna Direita: Preço e CTA */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-brand text-brand-foreground rounded-3xl p-6 shadow-lg shadow-brand/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">
                      Investimento Estimado
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black tabular-nums">
                        {brl(Number(selServico.preco_min) + subtotalMat)}
                      </span>
                      <span className="text-lg opacity-60 font-bold">até</span>
                      <span className="text-3xl font-black tabular-nums">
                        {brl(Number(selServico.preco_max) + subtotalMat)}
                      </span>
                    </div>
                    
                    <div className="mt-6 space-y-3 pt-6 border-t border-brand-foreground/20">
                      <div className="flex justify-between text-xs">
                        <span className="opacity-70">Mão de obra</span>
                        <span className="font-bold">{brl(Number(selServico.preco_min))} - {brl(Number(selServico.preco_max))}</span>
                      </div>
                      {subtotalMat > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="opacity-70">Materiais</span>
                          <span className="font-bold">{brl(subtotalMat)}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-8 flex flex-col gap-3">
                      <Button
                        onClick={handleNew}
                        disabled={saving}
                        className="w-full bg-white text-brand hover:bg-slate-50 rounded-2xl h-14 font-black text-base gap-3 shadow-xl"
                      >
                        {saving ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            Enviar solicitação <Send className="h-5 w-5" />
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setStep(4)}
                        className="w-full text-brand-foreground/80 hover:text-white hover:bg-brand-foreground/10 rounded-xl"
                        disabled={saving}
                      >
                        <ChevronLeft className="h-4 w-4 mr-2" /> Revisar materiais
                      </Button>
                    </div>
                  </div>

                  {/* Bloco de Pagamento Seguro */}
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-slate-800">
                      <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <h4 className="font-bold text-sm tracking-tight">Pagamento seguro</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Você só paga depois que o profissional enviar a proposta final e você aprovar. O pagamento será feito pela plataforma, em ambiente seguro.
                    </p>
                    <div className="space-y-2">
                      {[
                        "Envie sua solicitação",
                        "Receba a proposta do profissional",
                        "Aprove o orçamento",
                        "Pague com segurança"
                      ].map((txt, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="h-4 w-4 rounded-full bg-slate-200 text-[8px] flex items-center justify-center font-bold text-slate-500 shrink-0">
                            {i + 1}
                          </div>
                          <span className="text-[10px] font-medium text-slate-600">{txt}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                    <Info className="h-5 w-5 text-amber-600 shrink-0" />
                    <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                      O valor final e a disponibilidade da agenda serão confirmados pelo profissional no chat após o recebimento deste pedido.
                    </p>
                  </div>
                </div>
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
          const propsForO = propostas[o.id] || [];
          const hasProps = propsForO.length > 0;
          const s = (o.status === "customizado_pendente" && hasProps)
            ? { label: "Aguardando Aprovação", cls: "bg-blue-50 text-blue-700" }
            : (statusLabel[o.status] ?? {
                label: o.status,
                cls: "bg-slate-100 text-slate-700",
              });
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

              {/* Proposals List */}
              {(o.status === "customizado_pendente" || o.status === "enviado") &&
                propostas[o.id] &&
                propostas[o.id].length > 0 && (
                  <div className="mt-4 pt-4 border-t border-dashed border-border">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                      <Send className="h-3 w-3" /> Propostas Recebidas ({propostas[o.id].length})
                    </h4>
                    <div className="space-y-2">
                      {propostas[o.id].map((p) => (
                        <div
                          key={p.id}
                          className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-bold">{p.profNome || "Profissional"}</p>
                            <p className="text-lg font-black text-foreground">
                              {brl(Number(p.valor_servico))}
                            </p>
                            {p.observacoes && (
                              <p className="text-xs text-muted-foreground italic mt-1">
                                "{p.observacoes}"
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                await aceitarProp({
                                  data: { orcamentoId: o.id, propostaId: p.id },
                                });
                                toast.success("Proposta aceita! Agora você pode pagar.");
                                refresh();
                              } catch (err: any) {
                                toast.error(err.message);
                              }
                            }}
                            className="bg-brand text-brand-foreground rounded-full font-bold"
                          >
                            Aceitar Proposta
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
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
                {o.status === "aprovado" && (
                  <div className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-900">Orçamento Aprovado!</p>
                        <p className="text-xs text-emerald-700">Tudo pronto para começar seu serviço.</p>
                      </div>
                    </div>
                    <Button asChild className="w-full sm:w-auto bg-brand text-brand-foreground rounded-full font-bold h-11 px-6 shadow-lg shadow-brand/20">
                      <Link
                        to="/checkout"
                        search={{ orcamentoId: o.id } as any}
                      >
                        Ir para pagamento seguro <ChevronRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
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
