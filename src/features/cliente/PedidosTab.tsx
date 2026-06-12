import React, { useState, useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  Filter,
  ChevronDown,
  Clock,
  Download,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  FileText,
  CheckCircle2,
  MessageCircle,
  Phone,
  User,
  Calendar,
  AlertTriangle,
  Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { aceitarProposta, cancelarPedido, concluirPedido } from "@/lib/orcamentos.functions";
import { cancelarPedidoComSplit } from "@/lib/disputas.functions";
import { PagamentoSplitResumo } from "@/components/PagamentoSplitResumo";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SlotPicker } from "@/components/SlotPicker";
import { Chat } from "@/components/Chat";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tab, WHATSAPP_LINK } from "./constants";

const gerarPdfOrcamento = (id: string) =>
  import("@/lib/pdf-orcamento").then((m) => m.gerarPdfOrcamento(id));

interface PedidosTabProps {
  setActiveTab: (tab: Tab) => void;
}

export function PedidosTab({ setActiveTab }: PedidosTabProps) {
  const searchParams = useSearch({ strict: false }) as any;
  const { pedidoId, chat } = searchParams;
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showConversar, setShowConversar] = useState(false);
  const [approvalStep, setApprovalStep] = useState<
    null | "schedule" | "confirm" | "processing" | "success"
  >(null);
  const [dataAgendada, setDataAgendada] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const aceitarPropostaFn = useServerFn(aceitarProposta);
  const cancelarPedidoFn = useServerFn(cancelarPedido);
  const cancelarComSplitFn = useServerFn(cancelarPedidoComSplit);
  const concluirPedidoFn = useServerFn(concluirPedido);
  const [selectedProposta, setSelectedProposta] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState<string | null>(null);
  const [disputaOpen, setDisputaOpen] = useState(false);
  const [disputaMotivo, setDisputaMotivo] = useState("");
  const [disputaLoading, setDisputaLoading] = useState(false);

  const handleAbrirDisputa = async (orcamentoId: string) => {
    const motivo = disputaMotivo.trim();
    if (!motivo) {
      toast.error("Descreva o problema antes de abrir a disputa.");
      return;
    }
    setDisputaLoading(true);
    try {
      const { error } = await (supabase as any).rpc("abrir_disputa_orcamento", {
        _orcamento_id: orcamentoId,
        _motivo: motivo,
      });
      if (error) throw error;
      toast.success("Disputa aberta — nossa equipe vai analisar e entrar em contato");
      setDisputaOpen(false);
      setDisputaMotivo("");
      await queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos", user?.id] });
      await queryClient.refetchQueries({ queryKey: ["cliente", "pedidos", user?.id] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao abrir disputa");
    } finally {
      setDisputaLoading(false);
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    if (!confirm("Confirmar que o serviço foi concluído com sucesso? Isso vai liberar o repasse para o profissional.")) return;
    if (!session?.access_token) { toast.error("Sessão expirada. Faça login novamente."); return; }
    setIsCompleting(orderId);
    try {
      const { ok, error: serverError } = await concluirPedidoFn({
        data: { orcamentoId: orderId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!ok) throw new Error(serverError || "Erro ao concluir pedido.");
      toast.success("Serviço marcado como concluído!");
      queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos", user?.id] });
      await queryClient.refetchQueries({ queryKey: ["cliente", "pedidos", user?.id] });
    } catch (e: any) {
      toast.error("Erro ao concluir", { description: e.message });
    } finally {
      setIsCompleting(null);
    }
  };

  const handleDeleteOrder = async (orderId: string, title: string) => {
    // Detecta se o pedido já foi pago — nesse caso usa fluxo com split/reembolso.
    const pedido = (pedidos as any[]).find((p) => p.id === orderId);
    const status = String(pedido?.rawStatus || "").toLowerCase();
    const ehPago = ["pago"].includes(status);

    const confirmMsg = ehPago
      ? `Cancelar o pedido "${title}"?\n\nAs regras de reembolso serão aplicadas automaticamente conforme a fase do serviço (sem multa, multa de 20% se < 2h do horário, ou retenção se o profissional já fez check-in).`
      : `Tem certeza que deseja cancelar o pedido "${title}"?`;
    if (!confirm(confirmMsg)) return;

    setIsDeleting(orderId);
    try {
      if (pedidoId === orderId) {
        await navigate({
          to: "/cliente",
          search: (prev: any) => ({ ...prev, pedidoId: undefined, chat: undefined }),
        });
      }

      if (ehPago) {
        const res = await cancelarComSplitFn({
          data: { orcamentoId: orderId },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (!res.ok) throw new Error((res as any).error || "Erro ao cancelar");
        toast.success("Cancelamento processado. Confira o resumo financeiro nos detalhes do pedido.");
      } else {
        const { ok, error: serverError } = await cancelarPedidoFn({
          data: { orcamentoId: orderId },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (!ok) throw new Error(serverError || "Erro ao cancelar");
        toast.success("Pedido cancelado com sucesso.");
      }

      await queryClient.invalidateQueries({ queryKey: ["cliente"] });
      await queryClient.refetchQueries({ queryKey: ["cliente", "pedidos"] });
    } catch (e: any) {
      toast.error("Erro ao cancelar pedido", { description: e.message });
    } finally {
      setIsDeleting(null);
    }
  };

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["cliente", "pedidos", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("orcamentos")
        .select(
          "id, status, created_at, service_name, descricao, valor, valor_servico, cliente_id, profissional_id, tipo_atendimento, data_preferida, periodo_preferido, horario_preferido",
        )
        .eq("cliente_id", user.id)
        .order("created_at", { ascending: false });

      if (error) console.error("Error fetching orcamentos:", error);

      const list = data || [];

      const orcIds = list.map((o) => o.id);
      let propostas: any[] = [];
      const profsMap: Record<
        string,
        { nome: string; slug?: string; media?: string; totalAvaliacoes?: number }
      > = {};

      if (orcIds.length > 0) {
        const { data: pData } = await (supabase as any)
          .from("propostas")
          .select("id, orcamento_id, profissional_id, valor_servico, status, observacoes")
          .in("orcamento_id", orcIds);
        propostas = pData || [];
        const profIds = Array.from(new Set(propostas.map((p) => p.profissional_id)));

        if (profIds.length > 0) {
          // fetch names
          const { data: prData } = await supabase
            .from("profiles")
            .select("id, nome")
            .in("id", profIds);

          // fetch slugs
          const { data: perfilData } = await supabase
            .from("profissional_perfil")
            .select("user_id, slug")
            .in("user_id", profIds);

          // fetch ratings
          const { data: avData } = await supabase
            .from("avaliacoes")
            .select("profissional_id, nota")
            .in("profissional_id", profIds);

          (prData || []).forEach((p) => {
            const perf = (perfilData || []).find((pf) => pf.user_id === p.id);
            const avs = (avData || []).filter((av) => av.profissional_id === p.id);
            const media =
              avs.length > 0
                ? (avs.reduce((acc, a) => acc + a.nota, 0) / avs.length).toFixed(1)
                : undefined;

            profsMap[p.id] = {
              nome: p.nome,
              slug: perf?.slug ?? undefined,
              media,
              totalAvaliacoes: avs.length,
            };
          });
        }
      }

      return list.map((o) => {
        const propsForOrc = propostas
          .filter((p) => p.orcamento_id === o.id)
          .map((p) => ({
            ...p,
            profNome: profsMap[p.profissional_id]?.nome || "Profissional",
            profSlug: profsMap[p.profissional_id]?.slug,
            profMedia: profsMap[p.profissional_id]?.media,
            profTotalAvaliacoes: profsMap[p.profissional_id]?.totalAvaliacoes,
          }));
        const uiStatus =
          o.status === "customizado_pendente" && propsForOrc.length > 0
            ? "Aguardando sua aprovação"
            : o.status === "customizado_pendente"
              ? "Em Análise"
              : o.status === "enviado"
                ? "Aguardando sua aprovação"
                : o.status === "fixo_auto"
                  ? "Aprovação Automática"
                  : o.status === "aprovado"
                    ? "Aguardando Pagamento"
                    : o.status === "pago"
                      ? "Agendado"
                      : o.status === "concluido"
                        ? "Concluído"
                        : o.status;
        return {
          propostas: propsForOrc,
          ...o,
          rawStatus: o.status,
          title: o.service_name,
          description: o.descricao ?? "",
          uiStatus,
          status: uiStatus as string,
          date: new Date(o.created_at).toLocaleDateString(),
          prof: propsForOrc[0]?.profNome || "-",
          price: o.valor
            ? `R$ ${Number(o.valor).toFixed(2)}`
            : o.valor_servico
              ? `R$ ${Number(o.valor_servico).toFixed(2)}`
              : "A definir",
          displayPrice: o.valor
            ? `R$ ${Number(o.valor).toFixed(2)}`
            : o.valor_servico
              ? `R$ ${Number(o.valor_servico).toFixed(2)}`
              : "A definir",
        };
      });
    },
    enabled: !!user,
  });

  const filters = ["Todos", "Agendado", "Em Análise", "Aguardando sua aprovação"];

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("cliente-pedidos-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orcamentos",
          filter: `cliente_id=eq.${user.id}`,
        },
        async () => {
          console.info("[PedidosTab] Realtime Update - orcamentos", { userId: user.id });
          queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos", user.id] });
          await queryClient.refetchQueries({ queryKey: ["cliente", "pedidos", user.id] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "propostas",
        },
        async () => {
          console.info("[PedidosTab] Realtime Update - propostas");
          queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos", user.id] });
          await queryClient.refetchQueries({ queryKey: ["cliente", "pedidos", user.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const handleApprove = async () => {
    if (!selectedPedido) return;

    if (!session?.access_token) {
      toast.error("Sua sessão expirou. Faça login novamente.");
      return;
    }

    setApprovalStep("processing");
    try {
      if (selectedProposta) {
        if (!selectedProposta?.id) {
          toast.error("Proposta inválida. Atualize a página e tente novamente.");
          return;
        }

        console.info("[PedidosTab] Aceitando proposta", {
          propostaId: selectedProposta.id,
          propostaOrcamentoId: selectedProposta.orcamento_id,
          selectedPedidoId: selectedPedido.id,
        });

        const aceiteRes = await aceitarPropostaFn({
          data: {
            propostaId: selectedProposta.id,
            orcamentoId: selectedProposta.orcamento_id || selectedPedido.id,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        console.info("[PedidosTab] resultado aceitarProposta", aceiteRes);
        const reservaStatus = (aceiteRes as { agendaReserva?: string } | undefined)?.agendaReserva;
        if (
          reservaStatus === "sem_data" ||
          reservaStatus === "erro" ||
          reservaStatus === "sem_profissional"
        ) {
          toast.info(
            "Proposta aceita, mas a agenda não foi reservada automaticamente. Combine o horário pelo chat.",
          );
        }

        if (dataAgendada) {
          console.info("[PedidosTab] Atualizando data agendada", { data: dataAgendada });
          await supabase
            .from("orcamentos")
            .update({ data_agendada: dataAgendada.toISOString() })
            .eq("id", selectedPedido.id);
        }
      } else {
        const { error } = await supabase
          .from("orcamentos")
          .update({
            status: "aprovado",
            data_aprovacao: new Date().toISOString(),
            data_agendada: dataAgendada ? dataAgendada.toISOString() : null,
          })
          .eq("id", selectedPedido.id);
        if (error) throw error;
      }
    } catch (e: any) {
      toast.error("Erro ao aprovar", { description: e.message });
      setApprovalStep("confirm");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos", user?.id] });
    await queryClient.refetchQueries({ queryKey: ["cliente", "pedidos", user?.id] });
    setApprovalStep("success");
  };

  const selectedPedido = pedidoId ? pedidos.find((p) => p.id === pedidoId) : null;

  useEffect(() => {
    if (chat === "1" && selectedPedido?.profissional_id) {
      setShowConversar(true);
    }
  }, [chat, selectedPedido?.id, selectedPedido?.profissional_id]);

  const openPedido = (id: string) => {
    navigate({ to: "/cliente", search: (prev: any) => ({ ...prev, pedidoId: id }) });
  };

  const closePedido = () => {
    navigate({
      to: "/cliente",
      search: (prev: any) => ({ ...prev, pedidoId: undefined, chat: undefined }),
    });
  };

  const closeConversar = () => {
    setShowConversar(false);
    navigate({ to: "/cliente", search: (prev: any) => ({ ...prev, chat: undefined }) });
  };

  const filteredPedidos = pedidos.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "Todos" || p.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  if (selectedPedido) {
    const sp = selectedPedido;
    const primeiraProposta = sp.propostas?.[0] ?? null;
    const temProposta = !!primeiraProposta;
    const aguardandoAprovacao = sp.status === "Aguardando sua aprovação";
    const aguardandoPagamento = sp.status === "Aguardando Pagamento" || sp.rawStatus === "aprovado";
    const pagoOuAgendado = sp.status === "Agendado" || sp.rawStatus === "pago";
    const concluido = sp.rawStatus === "concluido";

    const statusLabel = aguardandoAprovacao
      ? "Aguardando sua aprovação"
      : aguardandoPagamento
        ? "Aguardando pagamento"
        : pagoOuAgendado
          ? "Serviço agendado"
          : concluido
            ? "Serviço concluído"
            : sp.status;

    const statusClass = aguardandoAprovacao
      ? "bg-amber-100 text-amber-700"
      : aguardandoPagamento
        ? "bg-emerald-100 text-emerald-700"
        : pagoOuAgendado
          ? "bg-blue-100 text-blue-700"
          : concluido
            ? "bg-green-100 text-green-700"
            : "bg-slate-100 text-slate-600";

    const propostaValor = primeiraProposta?.valor_servico
      ? `R$ ${Number(primeiraProposta.valor_servico).toFixed(2)}`
      : sp.price;

    const tipoAtendimentoLabel =
      (sp as any).tipo_atendimento === "mulher"
        ? "Profissional mulher"
        : (sp as any).tipo_atendimento === "homem"
          ? "Profissional homem"
          : (sp as any).tipo_atendimento === "homem_com_apoio_feminino"
            ? "Profissional + apoio feminino"
            : null;

    const agendaLabel = (sp as any).data_preferida
      ? `${new Date((sp as any).data_preferida + "T00:00:00").toLocaleDateString("pt-BR")} · ${
          (sp as any).periodo_preferido === "manha"
            ? "Manhã"
            : (sp as any).periodo_preferido === "tarde"
              ? "Tarde"
              : (sp as any).periodo_preferido === "noite"
                ? "Noite"
                : (sp as any).horario_preferido?.slice(0, 5) || "Horário a combinar"
        }`
      : null;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <button
          onClick={closePedido}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-brand transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar para pedidos
        </button>

        <section className="bg-white rounded-[2rem] border border-border p-6 md:p-8 shadow-soft">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-5">
              <div className="h-16 w-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg shrink-0">
                {sp.id.slice(0, 4)}
              </div>

              <div>
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClass}`}
                >
                  {statusLabel}
                </span>
                <h2 className="text-2xl md:text-3xl font-bold mt-3">{sp.title}</h2>
                {sp.description && (
                  <p className="text-muted-foreground mt-2 max-w-2xl">{sp.description}</p>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  {tipoAtendimentoLabel && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft/20 text-brand px-3 py-1.5 text-xs font-bold">
                      <User className="h-3.5 w-3.5" />
                      {tipoAtendimentoLabel}
                    </span>
                  )}

                  {agendaLabel && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 text-slate-600 px-3 py-1.5 text-xs font-bold">
                      <Calendar className="h-3.5 w-3.5" />
                      {agendaLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:text-right">
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                Investimento
              </p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{sp.price}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="space-y-6">
            <section className="bg-white rounded-[2rem] border border-border p-6 md:p-8 shadow-soft">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-6">
                <Clock className="h-5 w-5 text-brand" />
                Linha do tempo
              </h3>

              <div className="space-y-6 pl-4 border-l-2 border-slate-100">
                <div className="relative pl-6">
                  <div className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full bg-brand border-4 border-white shadow-sm" />
                  <p className="text-sm font-bold">Pedido solicitado</p>
                  <p className="text-xs text-muted-foreground">{sp.date}</p>
                </div>

                {(aguardandoAprovacao || aguardandoPagamento || pagoOuAgendado) && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full bg-amber-500 border-4 border-white shadow-sm" />
                    <p className="text-sm font-bold">Orçamento enviado</p>
                    <p className="text-xs text-muted-foreground">Proposta recebida</p>
                  </div>
                )}

                {aguardandoPagamento && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm" />
                    <p className="text-sm font-bold">Aguardando pagamento</p>
                    <p className="text-xs text-muted-foreground">Próximo passo: pagamento seguro</p>
                  </div>
                )}

                {pagoOuAgendado && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full bg-blue-500 border-4 border-white shadow-sm" />
                    <p className="text-sm font-bold">Serviço em andamento</p>
                    <p className="text-xs text-muted-foreground">{sp.date}</p>
                  </div>
                )}

                {concluido && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full bg-green-500 border-4 border-white shadow-sm" />
                    <p className="text-sm font-bold">Serviço concluído</p>
                    <p className="text-xs text-muted-foreground">{sp.date}</p>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white rounded-[2rem] border border-border p-6 md:p-8 shadow-soft">
              <h3 className="font-bold text-lg mb-5">Detalhes do pedido</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                    Serviço
                  </p>
                  <p className="font-bold">{sp.title}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                    Atendimento
                  </p>
                  <p className="font-bold">{tipoAtendimentoLabel || "Não informado"}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                    Agenda desejada
                  </p>
                  <p className="font-bold">{agendaLabel || "A combinar"}</p>
                </div>
              </div>
            </section>

            {sp.propostas && sp.propostas.length > 1 && (
              <section className="bg-white rounded-[2rem] border border-border p-6 md:p-8 shadow-soft">
                <h3 className="font-bold text-lg mb-5">Outras propostas</h3>
                <div className="grid gap-3">
                  {sp.propostas.slice(1).map((prop: any) => (
                    <div
                      key={prop.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="font-bold flex items-center gap-2">
                          {prop.profNome || "Profissional"}
                          {prop.profMedia && (
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-100">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {prop.profMedia}
                            </span>
                          )}
                        </p>
                        {prop.profSlug && (
                          <a
                            href={`/profissionais/perfil/${prop.profSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand hover:underline block mt-1"
                          >
                            Ver Perfil e Avaliações
                          </a>
                        )}
                        {prop.observacoes && (
                          <p className="text-xs text-muted-foreground mt-2">{prop.observacoes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">R$ {Number(prop.valor_servico).toFixed(2)}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full mt-2"
                          onClick={() => {
                            setSelectedProposta(prop);
                            setDataAgendada(null);
                            setApprovalStep(sp.profissional_id ? "schedule" : "confirm");
                          }}
                        >
                          Escolher
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-6">
            {aguardandoAprovacao && temProposta && (
              <section className="bg-white rounded-[2rem] border border-border p-6 md:p-8 shadow-soft">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                  Proposta recebida
                </p>
                <h3 className="text-xl font-bold mb-2">Revise e aprove para seguir</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Revise o valor enviado pelo profissional. Ao aceitar, você segue para o pagamento
                  seguro pela plataforma.
                </p>

                <div className="rounded-2xl bg-slate-50 p-5 mb-5">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                    Profissional que enviou a proposta
                  </p>
                  <p className="font-bold text-lg flex items-center gap-2">
                    {primeiraProposta.profNome || "Profissional"}
                    {primeiraProposta.profMedia && (
                      <span className="inline-flex items-center gap-1 text-sm bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-bold border border-amber-100">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {primeiraProposta.profMedia}
                      </span>
                    )}
                  </p>
                  {primeiraProposta.profSlug && (
                    <a
                      href={`/profissionais/perfil/${primeiraProposta.profSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand hover:underline inline-block mt-1 mb-2"
                    >
                      Ver Perfil e Avaliações
                    </a>
                  )}
                  {primeiraProposta.observacoes && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {primeiraProposta.observacoes}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-brand text-white p-5 mb-5">
                  <p className="text-xs uppercase tracking-widest opacity-80 font-bold mb-1">
                    Valor final
                  </p>
                  <p className="text-3xl font-bold">{propostaValor}</p>
                </div>

                <Button
                  className="w-full rounded-full h-13 bg-brand text-white font-bold shadow-lg"
                  onClick={() => {
                    setSelectedProposta(primeiraProposta);
                    setDataAgendada(null);
                    setApprovalStep(sp.profissional_id ? "schedule" : "confirm");
                  }}
                >
                  Aceitar proposta
                </Button>

                <Button
                  variant="outline"
                  className="w-full rounded-full h-12 font-bold mt-3"
                  onClick={() => setShowConversar(true)}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Conversar
                </Button>

                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Após aceitar, o próximo passo será o pagamento seguro.
                </p>
              </section>
            )}

            {aguardandoPagamento && (
              <section className="bg-white rounded-[2rem] border border-emerald-100 p-6 md:p-8 shadow-soft">
                <p className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold mb-2">
                  Pagamento pendente
                </p>
                <h3 className="text-xl font-bold mb-2">Sua proposta foi aceita</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Para confirmar o serviço, siga para o pagamento seguro pela plataforma.
                </p>
                <Button
                  className="w-full rounded-full h-13 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg"
                  onClick={() => navigate({ to: `/checkout?orcamentoId=${sp.id}` })}
                >
                  Ir para pagamento seguro
                </Button>
              </section>
            )}

            {!temProposta && sp.status === "Em Análise" && (
              <section className="bg-white rounded-[2rem] border border-border p-6 md:p-8 shadow-soft">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                  Aguardando proposta
                </p>
                <h3 className="text-xl font-bold mb-2">Pedido enviado</h3>
                <p className="text-sm text-muted-foreground">
                  Seu pedido foi enviado aos profissionais. Assim que uma proposta chegar, ela
                  aparecerá aqui.
                </p>
              </section>
            )}

            {pagoOuAgendado && (
              <section className="bg-white rounded-[2rem] border border-blue-100 p-6 md:p-8 shadow-soft">
                <p className="text-[10px] uppercase tracking-widest text-blue-700 font-bold mb-2">
                  Serviço Agendado
                </p>
                <h3 className="text-xl font-bold mb-2">Serviço em andamento</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Combine os detalhes finais com o profissional pelo chat. Após a execução, marque
                  como concluído para liberar o repasse.
                </p>
                <Button
                  className="w-full rounded-full h-13 bg-brand hover:bg-brand/90 text-white font-bold shadow-lg"
                  disabled={isCompleting === sp.id}
                  onClick={() => handleCompleteOrder(sp.id)}
                >
                  {isCompleting === sp.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                  )}
                  Marcar como Concluído
                </Button>
              </section>
            )}

            {(sp.rawStatus === "pago" || sp.rawStatus === "concluido") && (
              <section className="bg-white rounded-[2rem] border border-border p-5 shadow-soft">
                <Button
                  variant="outline"
                  className="w-full rounded-full h-12 font-bold text-red-600 border-red-200 hover:bg-red-50 transition-colors"
                  onClick={() => {
                    setDisputaMotivo("");
                    setDisputaOpen(true);
                  }}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Problemas com o serviço?
                </Button>
              </section>
            )}

            {sp.rawStatus === "em_disputa" && (
              <section className="bg-amber-50 rounded-[2rem] border border-amber-200 p-5 shadow-soft">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm font-bold text-amber-900">
                    Disputa em análise pela equipe
                  </p>
                </div>
              </section>
            )}




            {concluido && (
              <section className="bg-white rounded-[2rem] border border-green-100 p-6 md:p-8 shadow-soft bg-green-50/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-green-900">Serviço Finalizado</h3>
                    <p className="text-sm text-green-700">Aprovado e repasse liberado.</p>
                  </div>
                </div>
              </section>
            )}

            {(pagoOuAgendado || concluido) && sp.profissional_id && (
              <section className="bg-white rounded-[2rem] border border-border p-5 shadow-soft">
                <Button
                  variant="outline"
                  className="w-full rounded-full h-12 font-bold"
                  onClick={() => setShowConversar(true)}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Conversar com o profissional
                </Button>
              </section>
            )}

            <section className="bg-white rounded-[2rem] border border-border p-5 shadow-soft">
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="rounded-full h-12 font-bold"
                  onClick={() => window.open(WHATSAPP_LINK, "_blank")}
                >
                  Suporte
                </Button>

                <Button
                  variant="outline"
                  className="rounded-full h-12 font-bold"
                  onClick={async () => {
                    try {
                      await gerarPdfOrcamento(sp.id);
                    } catch (e: any) {
                      toast.error(e?.message || "Erro ao gerar PDF");
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar PDF
                </Button>

                {!["concluido", "cancelado", "em_disputa"].includes(sp.rawStatus?.toLowerCase?.() || "") && (
                  <Button
                    variant="outline"
                    className="rounded-full h-12 font-bold text-red-500 hover:bg-red-50 hover:border-red-200"
                    disabled={isDeleting === sp.id}
                    onClick={() => handleDeleteOrder(sp.id, sp.title)}
                  >
                    {isDeleting === sp.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Cancelar pedido
                  </Button>
                )}
              </div>

              {["pago", "concluido", "cancelado", "em_disputa"].includes(sp.rawStatus?.toLowerCase?.() || "") && (
                <div className="mt-6">
                  <PagamentoSplitResumo orcamentoId={sp.id} />
                </div>
              )}
            </section>
          </aside>
        </div>

        {showConversar && selectedPedido && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={closeConversar}
            />
            <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              {selectedPedido.profissional_id ? (
                <div className="p-4">
                  <Chat
                    orcamentoId={selectedPedido.id}
                    contraparteId={selectedPedido.profissional_id}
                    contraparteNome={sp.prof}
                  />
                  <Button
                    variant="ghost"
                    onClick={closeConversar}
                    className="w-full mt-2 text-xs uppercase tracking-widest font-bold"
                  >
                    Fechar
                  </Button>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Aguardando profissional aceitar para iniciar a conversa.
                  </p>
                  <Button
                    variant="ghost"
                    onClick={closeConversar}
                    className="w-full font-bold text-xs uppercase tracking-widest"
                  >
                    Fechar
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {approvalStep && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() =>
                approvalStep === "confirm" || approvalStep === "schedule"
                  ? setApprovalStep(null)
                  : undefined
              }
            />
            <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
              {approvalStep === "schedule" && selectedPedido?.profissional_id && (
                <div className="p-8 md:p-10">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold">Escolha o horário</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Selecione data e hora disponíveis na agenda do profissional.
                    </p>
                  </div>
                  <SlotPicker
                    profissionalId={selectedPedido.profissional_id}
                    value={dataAgendada}
                    onChange={setDataAgendada}
                  />
                  <div className="flex gap-3 mt-8">
                    <Button
                      variant="outline"
                      onClick={() => setApprovalStep(null)}
                      className="flex-1 rounded-full h-12 font-bold"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => setApprovalStep("confirm")}
                      className="flex-1 bg-brand text-white rounded-full h-12 font-bold shadow-lg disabled:opacity-50"
                    >
                      Continuar
                    </Button>
                  </div>
                </div>
              )}

              {approvalStep === "confirm" && (
                <div className="p-8 md:p-10">
                  <div className="text-center mb-8">
                    <div className="h-16 w-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl font-bold">Aceitar proposta</h3>
                    <p className="text-muted-foreground mt-2 text-sm">
                      Ao aceitar, o profissional será notificado e o próximo passo será o pagamento
                      seguro pela plataforma.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 space-y-4 mb-8">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Serviço</span>
                      <span className="font-bold">{sp.title}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Profissional</span>
                      <span className="font-bold">{selectedProposta?.profNome || sp.prof}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-200 flex justify-between">
                      <span className="font-bold text-brand">Total</span>
                      <span className="font-bold text-brand text-lg">
                        {selectedProposta?.valor_servico
                          ? `R$ ${Number(selectedProposta.valor_servico).toFixed(2)}`
                          : sp.price}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setApprovalStep(null)}
                      className="flex-1 rounded-full h-13 font-bold"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleApprove}
                      className="flex-1 bg-brand text-white rounded-full h-13 font-bold shadow-lg hover:scale-[1.02] transition-transform"
                    >
                      Aceitar proposta
                    </Button>
                  </div>
                </div>
              )}

              {approvalStep === "processing" && (
                <div className="p-12 text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-brand mx-auto mb-6" />
                  <h3 className="text-2xl font-bold mb-3">Processando...</h3>
                  <p className="text-muted-foreground text-sm">
                    Confirmando sua aprovação e notificando o profissional.
                  </p>
                </div>
              )}

              {approvalStep === "success" && (
                <div className="p-10 text-center">
                  <div className="h-24 w-24 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-500">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Proposta aceita!</h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    O profissional foi notificado e seu pedido está pronto para o pagamento.
                  </p>
                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={() => navigate({ to: `/checkout?orcamentoId=${selectedPedido.id}` })}
                      className="w-full bg-brand text-white rounded-full h-14 font-bold shadow-lg"
                    >
                      Ir para pagamento seguro
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setApprovalStep(null)}
                      className="w-full rounded-full h-12 font-bold text-muted-foreground"
                    >
                      Depois
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <Dialog open={disputaOpen} onOpenChange={(o) => { setDisputaOpen(o); if (!o) setDisputaMotivo(""); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abrir disputa</DialogTitle>
              <DialogDescription>
                Conte o que aconteceu para que nossa equipe analise o caso.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-bold">Descreva o problema</label>
              <Textarea
                value={disputaMotivo}
                onChange={(e) => setDisputaMotivo(e.target.value)}
                placeholder="Ex.: o serviço não foi executado conforme combinado..."
                rows={5}
                required
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDisputaOpen(false)}
                disabled={disputaLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleAbrirDisputa(sp.id)}
                disabled={disputaLoading || !disputaMotivo.trim()}
              >
                {disputaLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Abrir disputa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por ID ou serviço..."
            className="w-full pl-12 pr-4 py-3.5 rounded-full border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-soft transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 px-6 h-11 rounded-full border border-border bg-white text-sm font-bold shadow-sm hover:bg-slate-50 transition-all"
            >
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span>
                Status: <span className="text-brand">{activeFilter}</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${showFilterDropdown ? "rotate-180" : ""}`}
              />
            </button>

            {showFilterDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />
                <div className="absolute top-full mt-2 right-0 w-56 bg-white rounded-2xl border border-border shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
                  {filters.map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setActiveFilter(f);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-5 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50 ${
                        activeFilter === f ? "text-brand bg-brand-soft/20" : "text-muted-foreground"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block" />

          <Button
            onClick={() => navigate({ to: "/servicos" })}
            className="rounded-full px-8 bg-brand hover:bg-brand/90 text-white shadow-lg shadow-brand/20 font-bold h-11"
          >
            Novo Pedido
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {isLoading &&
          [...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-border shadow-soft space-y-6"
            >
              <div className="flex justify-between">
                <div className="flex gap-4">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          ))}

        {!isLoading && filteredPedidos.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground font-medium bg-white rounded-[2.5rem] border border-dashed border-border">
            Nenhum pedido encontrado com esses termos.
          </div>
        ) : (
          !isLoading &&
          filteredPedidos.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                openPedido(p.id);
              }}
              className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-border shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-5">
                <div
                  className={`h-16 w-16 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    p.status === "Agendado"
                      ? "bg-blue-50 text-blue-600"
                      : p.status === "Em Análise"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {p.id.slice(0, 4)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg group-hover:text-brand transition-colors">
                      {p.title}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        p.status === "Agendado"
                          ? "bg-blue-100 text-blue-700"
                          : p.status === "Concluído"
                            ? "bg-green-100 text-green-700"
                            : p.status === "Em Análise"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {p.uiStatus}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {p.descricao || "Sem descrição."}
                  </p>
                  <div className="flex items-center gap-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />{" "}
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between md:flex-col md:items-end gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-0.5">
                    Investimento
                  </p>
                  <p className="text-xl font-bold text-slate-800">{p.displayPrice}</p>
                </div>
                <div className="flex items-center gap-3">
                  {(p.rawStatus === "enviado" || p.status === "Aguardando sua aprovação") && (
                    <Button className="rounded-full bg-brand hover:bg-brand/90 text-white font-bold h-11 px-6 shadow-md shadow-brand/20">
                      Ver Proposta
                    </Button>
                  )}
                  {p.rawStatus === "aprovado" && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({ to: `/checkout?orcamentoId=${p.id}` });
                      }}
                      className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 shadow-md shadow-emerald-200"
                    >
                      Pagar
                    </Button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteOrder(p.id, p.title);
                    }}
                    disabled={
                      isDeleting === p.id || ["pago", "concluido"].includes(p.status.toLowerCase())
                    }
                    title="Cancelar pedido"
                    className="h-10 w-10 rounded-full border border-border flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all disabled:opacity-30"
                  >
                    {isDeleting === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                  <div className="h-10 w-10 rounded-full border border-border flex items-center justify-center group-hover:bg-brand group-hover:text-white group-hover:border-brand transition-all">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
