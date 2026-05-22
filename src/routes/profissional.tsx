import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { Loader2 } from "lucide-react";
import { enviarOrcamento } from "@/lib/orcamentos.functions";
import { useQueryClient } from "@tanstack/react-query";

// Feature modules
import {
  Orcamento,
  Profile,
  ServicoCat,
  OrcMat,
  ClienteGeo,
  ProfissionalTab,
} from "@/features/profissional/types";
import { ProfissionalSidebar } from "@/features/profissional/ProfissionalSidebar";
import { ProfissionalDashboard } from "@/features/profissional/ProfissionalDashboard";
import { ProfissionalOrcamentos } from "@/features/profissional/ProfissionalOrcamentos";
import { ProfissionalServicos } from "@/features/profissional/ProfissionalServicos";
import { ProfissionalNotificacoes } from "@/features/profissional/ProfissionalNotificacoes";
import { ProfissionalStatusCard } from "@/features/profissional/ProfissionalStatusCard";
import { OrcamentoCard } from "@/features/profissional/OrcamentoCard";

// UI Components
import { ProfissionalConfiguracoes } from "@/components/ProfissionalConfiguracoes";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { PanicButton } from "@/components/PanicButton";
import { ProfissionalFinanceiro } from "@/components/ProfissionalFinanceiro";
import { ProfissionalAvaliacoes } from "@/components/ProfissionalAvaliacoes";
import { ProfissionalAgenda } from "@/components/ProfissionalAgenda";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { distanceKm } from "@/lib/geo";
import { carregarAgendaProfissional } from "@/lib/agenda";
import { isProfissionalCompativelComTipoAtendimento } from "@/lib/atendimento.compat";

export const Route = createFileRoute("/profissional")({
  validateSearch: z.object({
    tab: z
      .enum([
        "pedidos",
        "orcamentos",
        "servicos",
        "agenda",
        "financeiro",
        "avaliacoes",
        "configuracoes",
        "notificacoes",
      ])
      .optional()
      .catch("pedidos"),
    orcamentoId: z.string().optional(),
    chat: z.string().optional(),
  }),
  component: ProfissionalArea,
});

function ProfissionalArea() {
  const { tab = "pedidos", orcamentoId, chat } = Route.useSearch();
  const { user, isProfissional, loading, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [minhasPropostas, setMinhasPropostas] = useState<any[]>([]);
  const [materiaisCat, setMateriaisCat] = useState<any[]>([]);
  const [propostasMateriais, setPropostasMateriais] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [pedidosSubTab, setPedidosSubTab] = useState<string>("oportunidades");
  const [sheetOrcamentoId, setSheetOrcamentoId] = useState<string | null>(null);
  const [servicosSubTab, setServicosSubTab] = useState<string>("ativos");
  const [minhaAgenda, setMinhaAgenda] = useState<any>(null);
  const enviar = useServerFn(enviarOrcamento);
  const {
    notifications: profNotificationsAll,
    markAsRead: markNotifAsRead,
    markAllAsRead: markAllNotifAsRead,
  } = useNotifications();

  const profNotifications = profNotificationsAll.filter(
    (n) => !n.link || n.link.startsWith("/profissional"),
  );
  const unreadNotifications = profNotifications.filter((n) => !n.read).length;

  const [ativo, setAtivo] = useState(false);
  const [mediaAvaliacoes, setMediaAvaliacoes] = useState<string>("—");
  const [ganhosTotais, setGanhosTotais] = useState(0);
  const [aReceber, setAReceber] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [profGeo, setProfGeo] = useState<{ lat: number | null; lng: number | null; raio: number }>({
    lat: null,
    lng: null,
    raio: 15,
  });
  const [clienteGeo, setClienteGeo] = useState<Record<string, ClienteGeo>>({});
  const [ganhosMes, setGanhosMes] = useState(0);
  const [taxaAceitacao, setTaxaAceitacao] = useState<string>("—");
  const [slaMedioH, setSlaMedioH] = useState<string>("—");
  const [totalConcluidos, setTotalConcluidos] = useState(0);
  const [recusados, setRecusados] = useState<Set<string>>(new Set());
  const [propostasEnviadasLocal, setPropostasEnviadasLocal] = useState<Set<string>>(new Set());
  const [profGenero, setProfGenero] = useState<string | null>(null);
  const [profApoioFeminino, setProfApoioFeminino] = useState(false);

  const recusarOrcamento = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("orcamento_recusas")
      .insert({ orcamento_id: id, profissional_id: user.id });
    if (error) {
      toast.error("Não foi possível recusar agora.");
      return;
    }
    setRecusados((s) => new Set(s).add(id));
    toast.success("Pedido recusado e removido do seu radar.");
  };

  const [catalog, setCatalog] = useState<Record<string, ServicoCat>>({});
  const [orcMats, setOrcMats] = useState<Record<string, OrcMat[]>>({});

  const refresh = async () => {
    if (!user) return;

    // 1. Fetch EVERYTHING in parallel to ensure consistent state
    const [propsRes, orcsRes] = await Promise.all([
      supabase.from("propostas").select("*, orcamento_id").eq("profissional_id", user.id),
      supabase
        .from("orcamentos")
        .select("*")
        .or(`profissional_id.is.null,profissional_id.eq.${user.id}`)
        .order("created_at", { ascending: false }),
    ]);

    if (propsRes.error) {
      console.error("[ProfissionalArea.refresh] erro ao buscar propostas", propsRes.error);
    }
    if (orcsRes.error) {
      console.error("[ProfissionalArea.refresh] erro ao buscar orçamentos", orcsRes.error);
    }

    const propsList = propsRes.error ? null : propsRes.data || [];
    const propOrcIds = (propsList || []).map((p) => p.orcamento_id);

    // If there are budgets where I sent a proposal but I'm NOT the assigned professional,
    // we need to fetch those too.
    const missingOrcIds = propOrcIds.filter((id) => !orcsRes.data?.some((o) => o.id === id));

    let list = (orcsRes.data || []) as Orcamento[];
    if (missingOrcIds.length > 0) {
      const { data: missingOrcs } = await supabase
        .from("orcamentos")
        .select("*")
        .in("id", missingOrcIds);
      if (missingOrcs) list = [...list, ...(missingOrcs as Orcamento[])];
    }

    if (propsList !== null) {
      setMinhasPropostas(propsList);
    }
    setOrcamentos(list);

    console.info(
      "[ProfissionalArea] detalhes agenda/atendimento",
      list?.map((o) => ({
        id: o.id,
        service_name: o.service_name,
        status: o.status,
        tipo_atendimento: o.tipo_atendimento,
        data_preferida: o.data_preferida,
        periodo_preferido: o.periodo_preferido,
        horario_preferido: o.horario_preferido,
        flexibilidade_agenda: o.flexibilidade_agenda,
      })),
    );

    const agenda = await carregarAgendaProfissional(user.id);
    setMinhaAgenda(agenda);

    const meus = list.filter((o) => o.profissional_id === user?.id);
    const pagos = meus.filter((o) => o.status === "pago" || o.status === "concluido");
    const pendentesPgto = meus.filter((o) => o.status === "aprovado");

    const ganhos = pagos.reduce((acc, o) => acc + Number(o.valor || 0), 0);
    const receber = pendentesPgto.reduce((acc, o) => acc + Number(o.valor || 0), 0);
    const ticket = pagos.length > 0 ? ganhos / pagos.length : 0;

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const ganhosM = pagos
      .filter((o) => new Date(o.data_pagamento ?? o.updated_at) >= inicioMes)
      .reduce((acc, o) => acc + Number(o.valor || 0), 0);
    setGanhosMes(ganhosM);

    const enviadasOuFinalizadas = meus.filter((o) =>
      ["enviado", "aprovado", "pago", "concluido", "recusado"].includes(o.status),
    );
    const aceitas = enviadasOuFinalizadas.filter((o) => o.status !== "recusado");
    setTaxaAceitacao(
      enviadasOuFinalizadas.length > 0
        ? `${Math.round((aceitas.length / enviadasOuFinalizadas.length) * 100)}%`
        : "—",
    );

    const enviados = meus.filter((o) =>
      ["enviado", "aprovado", "pago", "concluido"].includes(o.status),
    );
    if (enviados.length > 0) {
      const horas =
        enviados.reduce((acc, o) => {
          const t = (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 36e5;
          return acc + Math.max(0, t);
        }, 0) / enviados.length;
      setSlaMedioH(horas < 1 ? `${Math.round(horas * 60)} min` : `${horas.toFixed(1)} h`);
    }

    setTotalConcluidos(meus.filter((o) => o.status === "concluido").length);
    setGanhosTotais(ganhos);
    setAReceber(receber);
    setTicketMedio(ticket);

    if (user) {
      let perfil: any = null;
      const { data: perfilCompleto, error: perfilCompletoError } = await (supabase as any)
        .from("profissional_perfil")
        .select(
          "ativo, especialidades, lat, lng, raio_atendimento_km, genero, oferece_apoio_feminino",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (perfilCompletoError) {
        console.warn(
          "[ProfissionalArea] perfil completo indisponível, tentando básico",
          perfilCompletoError,
        );

        const { data: perfilBasico, error: perfilBasicoError } = await (supabase as any)
          .from("profissional_perfil")
          .select("ativo, especialidades, lat, lng, raio_atendimento_km")
          .eq("user_id", user.id)
          .maybeSingle();

        if (perfilBasicoError) {
          console.error("[ProfissionalArea] erro ao carregar perfil básico", perfilBasicoError);
        }

        if (perfilBasico && typeof perfilBasico === "object" && !Array.isArray(perfilBasico)) {
          const pb = perfilBasico as any;
          perfil = {
            ativo: pb.ativo,
            especialidades: pb.especialidades || [],
            lat: pb.lat ?? null,
            lng: pb.lng ?? null,
            raio_atendimento_km: pb.raio_atendimento_km ?? 15,
            genero: null,
            oferece_apoio_feminino: false,
          };
        } else {
          perfil = null;
        }
      } else {
        perfil = perfilCompleto;
      }

      const { data: avs } = await supabase
        .from("avaliacoes")
        .select("nota")
        .eq("profissional_id", user.id!);

      if (perfil) {
        setAtivo(perfil.ativo);
        setEspecialidades(perfil.especialidades || []);
        setProfGeo({
          lat: perfil.lat ?? null,
          lng: perfil.lng ?? null,
          raio: perfil.raio_atendimento_km ?? 15,
        });
        setProfGenero(perfil.genero ?? null);
        setProfApoioFeminino(Boolean(perfil.oferece_apoio_feminino));
      }

      if (avs && avs.length > 0) {
        setMediaAvaliacoes((avs.reduce((acc, a) => acc + a.nota, 0) / avs.length).toFixed(1));
      }
      const { data: recs } = await supabase
        .from("orcamento_recusas")
        .select("orcamento_id")
        .eq("profissional_id", user.id!);
      setRecusados(new Set((recs ?? []).map((r: any) => r.orcamento_id)));
    }

    const ids = Array.from(new Set(list.map((o) => o.cliente_id)));
    if (ids.length) {
      const [{ data: profs }, { data: ends }] = await Promise.all([
        supabase.from("profiles").select("id, nome, whatsapp, email").in("id", ids),
        supabase
          .from("cliente_enderecos")
          .select("user_id, lat, lng, cidade, is_padrao")
          .in("user_id", ids),
      ]);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p: any) => (map[p.id] = p));
      setProfiles(map);
      const gmap: Record<string, ClienteGeo> = {};
      (ends ?? []).forEach((e: any) => {
        const cur = gmap[e.user_id];
        if (!cur || e.is_padrao) gmap[e.user_id] = { lat: e.lat, lng: e.lng, cidade: e.cidade };
      });
      setClienteGeo(gmap);
    }

    const serviceIds = Array.from(
      new Set(list.map((o) => o.service_id).filter(Boolean) as string[]),
    );
    if (serviceIds.length) {
      const { data: cats } = await supabase
        .from("services_catalog")
        .select("id, preco_min, preco_max, categoria")
        .in("id", serviceIds);
      const cmap: Record<string, ServicoCat> = {};
      (cats ?? []).forEach((c: any) => (cmap[c.id] = c));
      setCatalog(cmap);
    }

    const orcIds = list.map((o) => o.id);
    if (orcIds.length) {
      const propsRes2 = await (supabase as any)
        .from("propostas")
        .select("*")
        .eq("profissional_id", user?.id!)
        .in("orcamento_id", orcIds);
      if (propsRes2.error) {
        console.error("[ProfissionalArea.refresh] erro ao buscar propostas (2)", propsRes2.error);
      } else {
        setMinhasPropostas(propsRes2.data || []);
      }
      const propsData = propsRes2.data;

      const propIds = (propsData || []).map((p: any) => p.id);
      if (propIds.length > 0) {
        const { data: pmData } = await supabase
          .from("proposta_materiais")
          .select("*")
          .in("proposta_id", propIds);
        setPropostasMateriais(pmData || []);
      }

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

  const handleProposalSent = ({
    orcamentoId,
    proposta,
    orcamento,
  }: {
    orcamentoId: string;
    proposta: any;
    orcamento: any;
  }) => {
    console.log("[profissional.enviarOrcamento] proposta criada", proposta);
    console.log("[profissional.enviarOrcamento] orçamento atualizado", orcamento);
    console.log("[profissional.enviarOrcamento] invalidando queries");

    // Invalidate React Query caches
    queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
    queryClient.invalidateQueries({ queryKey: ["propostas"] });
    queryClient.invalidateQueries({ queryKey: ["profissional"] });
    queryClient.invalidateQueries({ queryKey: ["radar"] });

    // 1. Track locally that this professional sent a proposal for this orçamento
    setPropostasEnviadasLocal((prev) => {
      const next = new Set(prev);
      next.add(orcamentoId);
      return next;
    });

    // 2. Normalize proposta/orcamento defensively
    const propostaNormalizada = {
      ...proposta,
      orcamento_id: proposta?.orcamento_id ?? orcamentoId,
      profissional_id: proposta?.profissional_id ?? user?.id,
      status: proposta?.status ?? "pendente",
    };
    const orcamentoNormalizado = {
      ...orcamento,
      id: orcamentoId,
      status: orcamento?.status ?? "enviado",
    };

    // 3. Update orcamentos status locally
    setOrcamentos((prev) =>
      prev.map((o) => (o.id === orcamentoId ? { ...o, ...orcamentoNormalizado } : o)),
    );

    // 4. Add or update proposal in minhasPropostas locally (dedupe by id or orcamento_id)
    setMinhasPropostas((prev) => {
      const idx = prev.findIndex((p) =>
        propostaNormalizada.id && p.id
          ? p.id === propostaNormalizada.id
          : p.orcamento_id === propostaNormalizada.orcamento_id,
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...propostaNormalizada };
        return copy;
      }
      return [propostaNormalizada, ...prev];
    });

    // 5. Move the user immediately to the "Enviados" tab
    setPedidosSubTab("enviados");

    // 6. Delay background refresh so it doesn't overwrite optimistic state
    setTimeout(() => {
      refresh();
    }, 800);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    const channel = supabase
      .channel("prof-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orcamentos" }, () =>
        refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "propostas",
          filter: `profissional_id=eq.${user.id}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!orcamentoId || loadingList || orcamentos.length === 0) return;
    const o = orcamentos.find((x) => x.id === orcamentoId);
    if (!o) return;

    setSheetOrcamentoId(orcamentoId);

    const isMine = o.profissional_id === user?.id;
    const inServicos =
      isMine &&
      (o.status === "aprovado" ||
        o.status === "pago" ||
        o.status === "concluido" ||
        o.status === "cancelado" ||
        o.status === "recusado");
    const targetTab = inServicos ? "servicos" : "orcamentos";

    if (tab !== targetTab) {
      navigate({
        to: "/profissional",
        search: (prev: any) => ({ ...prev, tab: targetTab, orcamentoId, chat }),
      });
      return;
    }

    if (inServicos) {
      setServicosSubTab(o.status === "aprovado" || o.status === "pago" ? "ativos" : "finalizados");
    } else if (o.status === "customizado_pendente" && o.profissional_id === null) {
      setPedidosSubTab("oportunidades");
    } else if (o.status === "customizado_pendente" && o.profissional_id === user?.id) {
      setPedidosSubTab("elaboracao");
    } else if (o.status === "enviado") {
      setPedidosSubTab("enviados");
    }
  }, [orcamentoId, chat, orcamentos, loadingList, tab, user?.id, navigate]);

  const distanciaCliente = (clienteId: string): number | null => {
    if (profGeo.lat == null || profGeo.lng == null) return null;
    const g = clienteGeo[clienteId];
    if (!g || g.lat == null || g.lng == null) return null;
    return distanceKm({ lat: profGeo.lat, lng: profGeo.lng }, { lat: g.lat, lng: g.lng });
  };

  const filterBy = (
    type: "oportunidades" | "elaboracao" | "enviados" | "ativos" | "finalizados" | string,
  ) => {
    const jaEnvieiProposta = (orcamentoId: string) =>
      propostasEnviadasLocal.has(orcamentoId) ||
      minhasPropostas.some((p) => p.orcamento_id === orcamentoId);

    return orcamentos.filter((o) => {
      if (type === "oportunidades") {
        if (!(o.status === "customizado_pendente" || o.status === "enviado")) return false;
        if (jaEnvieiProposta(o.id)) return false;
        if (recusados.has(o.id)) return false;

        // Radius filter is still active as it's a hard constraint for logistics
        const d = distanciaCliente(o.cliente_id);
        if (d != null && d > profGeo.raio) return false;

        // Atendimento Compatibility filter
        const compat = isProfissionalCompativelComTipoAtendimento({
          tipoAtendimento: (o as any).tipo_atendimento,
          genero: profGenero as any,
          ofereceApoioFeminino: profApoioFeminino,
        });

        if (!compat.compatible && compat.blockProposal) return false;

        return true;
      }
      if (type === "elaboracao") {
        return (
          o.profissional_id === user?.id &&
          o.status === "customizado_pendente" &&
          !jaEnvieiProposta(o.id)
        );
      }
      if (type === "enviados") {
        return (
          (o.status === "customizado_pendente" || o.status === "enviado") && jaEnvieiProposta(o.id)
        );
      }
      if (type === "ativos") {
        return ["aprovado", "pago"].includes(o.status) && o.profissional_id === user?.id;
      }
      if (type === "finalizados") {
        return (
          ["recusado", "cancelado", "concluido"].includes(o.status) &&
          o.profissional_id === user?.id
        );
      }
      return false;
    });
  };

  const counts = useMemo(() => {
    return {
      oportunidades: filterBy("oportunidades").length,
      elaboracao: filterBy("elaboracao").length,
      enviados: filterBy("enviados").length,
      ativos: filterBy("ativos").length,
      finalizados: filterBy("finalizados").length,
    };
  }, [
    orcamentos,
    especialidades,
    user?.id,
    profGeo,
    clienteGeo,
    minhasPropostas,
    recusados,
    propostasEnviadasLocal,
  ]);

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

  const handleToggleAtivo = async (checked: boolean) => {
    if (!user) return;
    setAtivo(checked);
    const { error } = await supabase
      .from("profissional_perfil")
      .upsert({ user_id: user.id, ativo: checked, updated_at: new Date().toISOString() });
    if (error) {
      setAtivo(!checked);
      toast.error("Erro ao alterar status", { description: error.message });
    } else {
      toast.success(checked ? "Você está Online e visível" : "Você está Offline");
    }
  };

  const handleGenerateTestOrder = async () => {
    if (!user) return;
    const testServiceName = especialidades.length > 0 ? especialidades[0] : "Serviço Genérico";

    toast.loading("Gerando pedido de teste...", { id: "test-order" });
    const { error } = await supabase.from("orcamentos").insert({
      cliente_id: user.id,
      service_name: testServiceName,
      status: "customizado_pendente",
      descricao: "⚠️ Pedido de teste gerado pelo sistema para demonstrar o Radar de Oportunidades.",
    });

    if (error) {
      toast.error("Erro ao gerar teste", { id: "test-order", description: error.message });
    } else {
      toast.success(`Novo pedido de "${testServiceName}" gerado no Radar!`, { id: "test-order" });
    }
  };

  const sheetOrc = sheetOrcamentoId
    ? (orcamentos.find((o) => o.id === sheetOrcamentoId) ?? null)
    : null;

  const sheetMode = sheetOrc
    ? sheetOrc.profissional_id === user?.id
      ? sheetOrc.status === "enviado"
        ? "revisar"
        : sheetOrc.status === "customizado_pendente"
          ? "enviar"
          : "info"
      : "pegar"
    : "pegar";

  const handleNavigateToNotifPedido = (n: any) => {
    markNotifAsRead(n.id);
    if (n.pedidoId) {
      const titleLower = n.title.toLowerCase();
      const isServicos =
        titleLower.includes("aprovado") ||
        titleLower.includes("pago") ||
        titleLower.includes("conclu");
      navigate({
        to: "/profissional",
        search: (prev: any) => ({
          ...prev,
          tab: isServicos ? "servicos" : "orcamentos",
          orcamentoId: n.pedidoId,
        }),
      });
    } else if (n.link) {
      try {
        const url = new URL(n.link, window.location.origin);
        const oid = url.searchParams.get("orcamentoId");
        const t = (url.searchParams.get("tab") as any) || "orcamentos";
        navigate({
          to: "/profissional",
          search: (prev: any) => ({ ...prev, tab: t, orcamentoId: oid ?? undefined }),
        });
      } catch {
        navigate({ to: "/profissional", search: (prev: any) => ({ ...prev, tab: "orcamentos" }) });
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <OnboardingWizard />
      <PanicButton />

      <Sheet
        open={!!sheetOrc}
        onOpenChange={(open) => {
          if (!open) {
            setSheetOrcamentoId(null);
            navigate({
              to: "/profissional",
              search: (prev: any) => ({ ...prev, orcamentoId: undefined }),
            });
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto p-0"
          aria-describedby={undefined}
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border bg-slate-50">
            <SheetTitle className="text-lg font-bold">
              {sheetOrc?.service_name ?? "Pedido"}
            </SheetTitle>
          </SheetHeader>
          <div className="p-6">
            {sheetOrc && (
              <OrcamentoCard
                key={sheetOrc.id + "-sheet"}
                o={sheetOrc}
                cliente={profiles[sheetOrc.cliente_id]}
                clienteCidade={clienteGeo[sheetOrc.cliente_id]?.cidade ?? null}
                distanciaKm={null}
                range={sheetOrc.service_id ? catalog[sheetOrc.service_id] : undefined}
                materiais={orcMats[sheetOrc.id] ?? []}
                mode={sheetMode as any}
                enviar={enviar}
                onProposalSent={handleProposalSent}
                refresh={() => {
                  refresh();
                  setSheetOrcamentoId(null);
                  navigate({
                    to: "/profissional",
                    search: (prev: any) => ({ ...prev, orcamentoId: undefined }),
                  });
                }}
                userId={user?.id ?? ""}
                onRecusar={async (id) => {
                  await recusarOrcamento(id);
                  setSheetOrcamentoId(null);
                  navigate({
                    to: "/profissional",
                    search: (prev: any) => ({ ...prev, orcamentoId: undefined }),
                  });
                }}
                propostaMateriais={propostasMateriais}
                minhaAgenda={minhaAgenda}
                profGenero={profGenero}
                profApoioFeminino={profApoioFeminino}
                disableChat
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-64 shrink-0 space-y-6">
            <ProfissionalStatusCard
              userName={user?.user_metadata?.nome || "Profissional"}
              mediaAvaliacoes={mediaAvaliacoes}
              ativo={ativo}
              handleToggleAtivo={handleToggleAtivo}
            />

            <ProfissionalSidebar
              activeTab={tab as ProfissionalTab}
              setActiveTab={(newTab) =>
                navigate({
                  to: "/profissional",
                  search: (prev: any) => ({
                    ...prev,
                    tab: newTab,
                    orcamentoId: undefined,
                    chat: undefined,
                  }),
                })
              }
              counts={counts}
              unreadNotifications={unreadNotifications}
            />
          </aside>

          <main className="flex-1 min-w-0">
            {tab === "notificacoes" && (
              <ProfissionalNotificacoes
                notifications={profNotifications}
                unreadNotifications={unreadNotifications}
                markAsRead={markNotifAsRead}
                markAllAsRead={markAllNotifAsRead}
                onNavigateToPedido={handleNavigateToNotifPedido}
              />
            )}
            {tab === "configuracoes" && <ProfissionalConfiguracoes />}
            {tab === "financeiro" && <ProfissionalFinanceiro />}
            {tab === "avaliacoes" && <ProfissionalAvaliacoes />}
            {tab === "agenda" && <ProfissionalAgenda />}
            {tab === "servicos" && (
              <ProfissionalServicos
                servicosSubTab={servicosSubTab}
                setServicosSubTab={setServicosSubTab}
                counts={counts}
                filterBy={filterBy}
                profiles={profiles}
                catalog={catalog}
                orcMats={orcMats}
                clienteGeo={clienteGeo}
                profGeo={profGeo}
                userId={user?.id ?? ""}
                enviar={enviar}
                refresh={refresh}
                minhasPropostas={minhasPropostas}
                propostasMateriais={propostasMateriais}
                minhaAgenda={minhaAgenda}
                profGenero={profGenero}
                profApoioFeminino={profApoioFeminino}
              />
            )}
            {tab === "orcamentos" && (
              <ProfissionalOrcamentos
                pedidosSubTab={pedidosSubTab}
                setPedidosSubTab={setPedidosSubTab}
                counts={counts}
                aReceber={aReceber}
                loadingList={loadingList}
                filterBy={filterBy}
                profiles={profiles}
                catalog={catalog}
                orcMats={orcMats}
                clienteGeo={clienteGeo}
                profGeo={profGeo}
                userId={user?.id ?? ""}
                enviar={enviar}
                refresh={refresh}
                recusarOrcamento={recusarOrcamento}
                handleGenerateTestOrder={handleGenerateTestOrder}
                minhasPropostas={minhasPropostas}
                propostasMateriais={propostasMateriais}
                especialidades={especialidades}
                onProposalSent={handleProposalSent}
                minhaAgenda={minhaAgenda}
                profGenero={profGenero}
                profApoioFeminino={profApoioFeminino}
              />
            )}
            {tab === "pedidos" && (
              <ProfissionalDashboard
                user={user}
                counts={counts}
                metrics={{
                  ganhosMes,
                  taxaAceitacao,
                  slaMedioH,
                  totalConcluidos,
                  aReceber,
                  mediaAvaliacoes,
                }}
                orcamentos={orcamentos}
                setTab={(t) =>
                  navigate({ to: "/profissional", search: (prev: any) => ({ ...prev, tab: t }) })
                }
                setPedidosSubTab={setPedidosSubTab}
                setServicosSubTab={setServicosSubTab}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
