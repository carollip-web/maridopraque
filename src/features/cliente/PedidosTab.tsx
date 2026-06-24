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
  ShieldCheck,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
import { NivelBadge } from "@/components/NivelBadge";
import { AvaliacaoForm } from "@/components/AvaliacaoForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tab, SUPPORT_MAILTO } from "./constants";

const gerarPdfOrcamento = (id: string) =>
  import("@/lib/pdf-orcamento").then((m) => m.gerarPdfOrcamento(id));

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const catalogNameKey = (name: string | null | undefined) =>
  `name:${String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()}`;

interface PedidosTabProps {
  setActiveTab: (tab: Tab) => void;
}

export function PedidosTab({ setActiveTab }: PedidosTabProps) {
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;
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
  const [isCapturing, setIsCapturing] = useState<string | null>(null);
  const [disputaOpen, setDisputaOpen] = useState(false);
  const [disputaMotivo, setDisputaMotivo] = useState("");
  const [jaAvaliou, setJaAvaliou] = useState(false);
  const [disputaLoading, setDisputaLoading] = useState(false);

  // Brick State
  const [brickConfig, setBrickConfig] = useState<{ publicKey: string; amount: number; payerEmail: string } | null>(null);
  const [brickError, setBrickError] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const brickControllerRef = React.useRef<any>(null);
  const brickMountedRef = React.useRef(false);

  const handleAbrirDisputa = async (orcamentoId: string) => {
    const motivo = disputaMotivo.trim();
    if (!motivo) {
      toast.error("Descreva o problema antes de abrir a disputa.");
      return;
    }
    setDisputaLoading(true);
    try {
      const { error } = await supabase.rpc("abrir_disputa_orcamento", {
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
    const pedido = pedidos.find((p) => p.id === orderId);
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
          search: (prev: Record<string, unknown>) => ({ ...prev, pedidoId: undefined, chat: undefined }),
        });
      }

      if (ehPago) {
        const res = await cancelarComSplitFn({
          data: { orcamentoId: orderId },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (!res.ok) throw new Error((res as {error?: string}).error || "Erro ao cancelar");
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
          "id, status, created_at, service_id, service_name, descricao, valor, valor_servico, cliente_id, profissional_id, tipo_atendimento, data_preferida, periodo_preferido, horario_preferido, metragem_m2",
        )
        .eq("cliente_id", user.id)
        .order("created_at", { ascending: false });

      if (error) console.error("Error fetching orcamentos:", error);

      const list = data || [];

      const catalogMap: Record<string, any> = {};
      if (list.length > 0) {
        const { data: catalogData } = await supabase
          .from("services_catalog_publico")
          .select("id, nome, preco_min, preco_max");
        (catalogData || []).forEach((svc) => {
          if (!svc.id) return;
          catalogMap[svc.id] = svc;
          catalogMap[catalogNameKey(svc.nome)] = svc;
        });
      }

      const orcIds = list.map((o) => o.id);

      // Busca pagamentos separadamente (embed via PostgREST falhava)
      const pagamentosMap: Record<string, any> = {};
      if (orcIds.length > 0) {
        const { data: pagData } = await supabase
          .from("pagamentos")
          .select("orcamento_id, status_autorizacao, confirmacao_profissional_em, confirmacao_cliente_em, metadata, valor_total, created_at")
          .in("orcamento_id", orcIds)
          .order("created_at", { ascending: true });
        (pagData || []).forEach((pg) => {
          pagamentosMap[pg.orcamento_id] = pg; // ordem asc → fica o mais recente
        });
      }

      let propostas: any[] = [];
      const profsMap: Record<
        string,
        { nome: string; slug?: string; media?: string; totalAvaliacoes?: number; concluidos?: number }
      > = {};

      if (orcIds.length > 0) {
        const { data: pData } = await supabase
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

          // fetch concluidos
          const { data: concluidosData } = await supabase
            .from("orcamentos")
            .select("profissional_id")
            .in("profissional_id", profIds)
            .eq("status", "concluido");

          (prData || []).forEach((p) => {
            const perf = (perfilData || []).find((pf) => pf.user_id === p.id);
            const avs = (avData || []).filter((av) => av.profissional_id === p.id);
            const concluidosCount = (concluidosData || []).filter((c) => c.profissional_id === p.id).length;
            const media =
              avs.length > 0
                ? (avs.reduce((acc, a) => acc + a.nota, 0) / avs.length).toFixed(1)
                : undefined;

            profsMap[p.id] = {
              nome: p.nome,
              slug: perf?.slug ?? undefined,
              media,
              totalAvaliacoes: avs.length,
              concluidos: concluidosCount,
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
            profConcluidos: profsMap[p.profissional_id]?.concluidos,
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
                        : o.status === "disputa_resolvida"
                          ? "Disputa Resolvida"
                          : o.status;

        const lastPagamento = pagamentosMap[o.id] || null;

        const catalogSvc =
          (o.service_id ? catalogMap[o.service_id] : null) ?? catalogMap[catalogNameKey(o.service_name)];
        const unitMin = catalogSvc?.preco_min != null ? Number(catalogSvc.preco_min) : null;
        const unitMax = catalogSvc?.preco_max != null ? Number(catalogSvc.preco_max) : null;
        const metragem = o.metragem_m2 != null ? Number(o.metragem_m2) : 0;
        const isM2 = metragem > 0 && /\(m²?\)|\bm2\b|metro quadrado/i.test(`${o.service_name} ${catalogSvc?.nome ?? ""}`);
        const rangeMin = unitMin != null ? unitMin * (isM2 ? metragem : 1) : null;
        const rangeMax = unitMax != null ? unitMax * (isM2 ? metragem : 1) : null;
        const rangeDisplay =
          rangeMin != null && rangeMax != null
            ? rangeMin === rangeMax
              ? formatCurrency(rangeMin)
              : `${formatCurrency(rangeMin)} – ${formatCurrency(rangeMax)}`
            : null;

        return {
          propostas: propsForOrc,
          lastPagamento,
          ...o,
          rawStatus: o.status,
          title: o.service_name,
          description: o.descricao ?? "",
          uiStatus,
          status: uiStatus as string,
          date: new Date(o.created_at).toLocaleDateString(),
          prof: propsForOrc[0]?.profNome || "-",
          price: o.valor
            ? formatCurrency(Number(o.valor))
            : o.valor_servico
              ? formatCurrency(Number(o.valor_servico))
              : "A definir",
          displayPrice:
            propsForOrc[0]?.valor_servico != null
              ? formatCurrency(Number(propsForOrc[0].valor_servico))
              : o.valor != null
                ? formatCurrency(Number(o.valor))
                : rangeDisplay ?? (o.valor_servico != null ? formatCurrency(Number(o.valor_servico)) : "A definir"),
          rangeDisplay,
          unitRangeDisplay:
            isM2 && unitMin != null && unitMax != null
              ? `${metragem} m² × ${formatCurrency(unitMin)}–${formatCurrency(unitMax)}/m²`
              : null,
        };
      });
    },
    enabled: !!user,
  });

  const filters = ["Todos", "Ativos", "Concluídos", "Cancelados"];

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
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "avaliacoes",
          filter: `cliente_id=eq.${user.id}`,
        },
        () => {
          setJaAvaliou(true);
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
            dataAgendada: dataAgendada ? dataAgendada.toISOString() : null,
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
      throw e;
    }

    queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos", user?.id] });
    await queryClient.refetchQueries({ queryKey: ["cliente", "pedidos", user?.id] });
  };

  const initBrick = async () => {
    if (!selectedPedido) return;
    setBrickError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      // Buscar chave pública do sistema
      const { data, error } = await supabase.functions.invoke("mp-get-public-key", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || !data?.publicKey) {
        setBrickError("Não foi possível carregar o formulário de pagamento.");
        return;
      }

      // Calcula o valor a exibir no Brick (deve bater com mp-autorizar-pagamento)
      const { data: materiaisData } = await supabase
        .from("orcamento_materiais")
        .select("preco_unitario, quantidade")
        .eq("orcamento_id", selectedPedido.id);
      const valorMateriais = (materiaisData || []).reduce(
        (acc, m: any) => acc + Number(m.preco_unitario || 0) * Number(m.quantidade || 0),
        0,
      );
      const valorServico = Number(selectedProposta?.valor_servico || selectedPedido.price.replace("R$ ", "").replace(",", "."));
      const baseValue = valorServico + valorMateriais;
      const requiresApoio = selectedPedido.tipo_atendimento === "homem_com_apoio_feminino";
      const totalAmount = requiresApoio ? Math.round(baseValue * 1.3 * 100) / 100 : Math.round(baseValue * 100) / 100;

      setBrickConfig({
        publicKey: data.publicKey,
        amount: totalAmount,
        payerEmail: user?.email || "",
      });
      setApprovalStep("processing");
    } catch (e: any) {
      setBrickError("Falha ao inicializar pagamento.");
    }
  };

  useEffect(() => {
    if (approvalStep !== "processing" || !brickConfig || brickMountedRef.current) return;

    let cancelled = false;

    async function ensureSdk() {
      if ((window as any).MercadoPago) return (window as any).MercadoPago;
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[data-mp-sdk="v2"]');
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Falha ao carregar SDK MP")));
          return;
        }
        const s = document.createElement("script");
        s.src = "https://sdk.mercadopago.com/js/v2";
        s.async = true;
        s.dataset.mpSdk = "v2";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Falha ao carregar SDK MP"));
        document.head.appendChild(s);
      });
      return (window as any).MercadoPago;
    }

    (async () => {
      try {
        const MP = await ensureSdk();
        if (cancelled) return;
        const mp = new MP(brickConfig.publicKey, { locale: "pt-BR" });
        const bricksBuilder = mp.bricks();
        brickMountedRef.current = true;
        brickControllerRef.current = await bricksBuilder.create(
          "payment",
          "payment-brick-container",
          {
            initialization: {
              amount: brickConfig.amount,
              payer: { email: brickConfig.payerEmail },
            },
            customization: {
              paymentMethods: { creditCard: "all", debitCard: "all", maxInstallments: 1 },
              visual: { style: { theme: "default" } },
            },
            callbacks: {
              onReady: () => {},
              onError: (err: any) => {
                setBrickError("Erro no formulário.");
              },
              onSubmit: async ({ formData }: any) => {
                try {
                  setIsProcessingPayment(true);
                  const { data: sessionData } = await supabase.auth.getSession();
                  const token = sessionData.session?.access_token;
                  if (!token) throw new Error("Sessão expirada");

                  // 1) Aceita a proposta PRIMEIRO (move orcamento -> aprovado).
                  //    Se falhar, não cobra o cartão e o usuário vê o erro.
                  await handleApprove();

                  // 2) Autoriza o cartão (reserva). Só depois da proposta aceita.
                  const { data, error } = await supabase.functions.invoke("mp-autorizar-pagamento", {
                    body: { orcamento_id: selectedPedido?.id, card_token: formData.token },
                    headers: { Authorization: `Bearer ${token}` },
                  });

                  if (error || !data?.ok) {
                    throw new Error(data?.message || "Falha na autorização do cartão.");
                  }

                  setApprovalStep("success");
                  toast.success("Proposta aceita e cartão autorizado!");
                  // Fecha o modal e atualiza a lista automaticamente
                  setTimeout(() => {
                    setApprovalStep(null);
                    queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos", user?.id] });
                    queryClient.refetchQueries({ queryKey: ["cliente", "pedidos", user?.id] });
                  }, 1500);
                } catch (e: any) {
                  toast.error(e?.message || "Falha ao processar autorização");
                } finally {
                  setIsProcessingPayment(false);
                }
              },
            },
          }
        );
      } catch (e) {
        if (!cancelled) {
          setBrickError("Falha ao iniciar o formulário.");
          brickMountedRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        brickControllerRef.current?.unmount?.();
      } catch {}
      brickControllerRef.current = null;
      brickMountedRef.current = false;
    };
  }, [approvalStep, brickConfig, pedidoId]);

  const handleCapture = async (orcamentoId: string) => {
    setIsCapturing(orcamentoId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");

      const { data, error } = await supabase.functions.invoke("mp-capturar-pagamento", {
        body: { orcamento_id: orcamentoId, ator: "cliente" },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || !data?.ok) {
        throw new Error(data?.message || "Erro ao capturar pagamento.");
      }

      toast.success(`Serviço finalizado com sucesso! O valor de R$ ${data.captured_amount?.toFixed(2) || "..."} foi debitado do seu cartão.`);
      queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos", user?.id] });
      await queryClient.refetchQueries({ queryKey: ["cliente", "pedidos", user?.id] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao capturar pagamento.");
    } finally {
      setIsCapturing(null);
    }
  };

  const selectedPedido = pedidoId ? pedidos.find((p) => p.id === pedidoId) : null;
  const [profPublico, setProfPublico] = useState<any>(null);

  // Carrega dados públicos do profissional para exibir no card de proposta/atendimento.
  // Usa o profissional_id do pedido (após aceite) OU o da primeira proposta recebida.
  const propostaProfId = (selectedPedido?.propostas?.[0]?.profissional_id as string | undefined) ?? null;
  const profIdParaCard = (selectedPedido?.profissional_id as string | undefined) ?? propostaProfId;
  useEffect(() => {
    if (!profIdParaCard) {
      setProfPublico(null);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("profissionais_publicos")
        .select("foto_url, especialidades, aprovacao_status, bio, cidade, anos_experiencia, slug, created_at")
        .eq("user_id", profIdParaCard)
        .maybeSingle();
      if (active) setProfPublico(data);
    })();
    return () => {
      active = false;
    };
  }, [profIdParaCard]);

  useEffect(() => {
    if (!selectedPedido?.id || selectedPedido.rawStatus !== "concluido") {
      setJaAvaliou(false);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("avaliacoes")
        .select("id")
        .eq("orcamento_id", selectedPedido.id)
        .maybeSingle();
      if (active) setJaAvaliou(!!data);
    })();
    return () => { active = false; };
  }, [selectedPedido?.id, selectedPedido?.rawStatus]);

  useEffect(() => {
    if (chat === "1" && selectedPedido?.profissional_id) {
      setShowConversar(true);
    }
  }, [chat, selectedPedido?.id, selectedPedido?.profissional_id]);

  const openPedido = (id: string) => {
    navigate({ to: "/cliente", search: (prev: Record<string, unknown>) => ({ ...prev, pedidoId: id }) });
  };

  const closePedido = () => {
    navigate({
      to: "/cliente",
      search: (prev: Record<string, unknown>) => ({ ...prev, pedidoId: undefined, chat: undefined }),
    });
  };

  const closeConversar = () => {
    setShowConversar(false);
    navigate({ to: "/cliente", search: (prev: Record<string, unknown>) => ({ ...prev, chat: undefined }) });
  };

  const filteredPedidos = pedidos.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesFilter = true;
    if (activeFilter === "Ativos") {
      matchesFilter = ["Em Análise", "Aguardando sua aprovação", "Aguardando Pagamento", "Agendado", "Aprovação Automática", "enviado"].includes(p.status) || ["customizado_pendente", "aprovado", "pago", "fixo_auto", "enviado"].includes(p.rawStatus);
    } else if (activeFilter === "Concluídos") {
      matchesFilter = ["Concluído", "Disputa Resolvida"].includes(p.status) || ["concluido", "disputa_resolvida"].includes(p.rawStatus);
    } else if (activeFilter === "Cancelados") {
      matchesFilter = p.status === "cancelado" || p.rawStatus === "cancelado";
    }

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
      sp.tipo_atendimento === "mulher"
        ? "Profissional mulher"
        : sp.tipo_atendimento === "homem"
          ? "Profissional homem"
          : sp.tipo_atendimento === "homem_com_apoio_feminino"
            ? "Profissional + apoio feminino"
            : null;

    const agendaLabel = sp.data_preferida
      ? `${new Date(sp.data_preferida + "T00:00:00").toLocaleDateString("pt-BR")} · ${
          sp.periodo_preferido === "manha"
            ? "Manhã"
            : sp.periodo_preferido === "tarde"
              ? "Tarde"
              : sp.periodo_preferido === "noite"
                ? "Noite"
                : sp.horario_preferido?.slice(0, 5) || "Horário a combinar"
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
              <p className="text-3xl font-bold text-slate-800 mt-1">{sp.displayPrice}</p>
              {sp.rangeDisplay && !temProposta && (
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  Faixa estimada da mão de obra
                  {sp.unitRangeDisplay ? ` · ${sp.unitRangeDisplay}` : ""}
                </p>
              )}
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

                {sp.rangeDisplay && (
                  <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 md:col-span-2">
                    <p className="text-[10px] uppercase tracking-widest text-amber-700 font-bold mb-1">
                      Faixa estimada da mão de obra
                    </p>
                    <p className="font-bold text-slate-900">{sp.rangeDisplay}</p>
                    {sp.unitRangeDisplay && (
                      <p className="mt-1 text-xs font-medium text-amber-700">{sp.unitRangeDisplay}</p>
                    )}
                  </div>
                )}
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
            {profPublico && (
              <section className="bg-white rounded-[2rem] border border-border p-6 md:p-8 shadow-soft">
                <h3 className="font-bold text-lg mb-4">Quem vai te atender</h3>
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14 rounded-xl">
                    {profPublico.foto_url ? (
                      <AvatarImage src={profPublico.foto_url} alt={sp.prof} className="rounded-xl" />
                    ) : null}
                    <AvatarFallback className="rounded-xl bg-brand-soft text-brand font-bold text-lg">
                      {String(sp.prof || "P").charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-base truncate">{sp.prof}</p>
                    </div>
                    {profPublico.aprovacao_status === "aprovado" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-0.5 mt-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Identidade verificada
                      </span>
                    )}
                    {(() => {
                      const prop = sp.propostas?.find((p: any) => p.profissional_id === sp.profissional_id) || sp.propostas?.[0];
                      if (!prop) return null;
                      return (
                        <div className="mt-3 mb-1 space-y-1">
                          <NivelBadge concluidos={prop.profConcluidos || 0} notaMedia={Number(prop.profMedia) || 0} compact />
                          <p className="text-xs text-slate-500 font-medium">
                            {prop.profTotalAvaliacoes > 0 ? (
                              <>⭐ {prop.profMedia} ({prop.profTotalAvaliacoes} avaliações)</>
                            ) : "Novo na plataforma"}
                          </p>
                          <p className="text-xs text-slate-500 font-medium">
                            {prop.profConcluidos || 0} serviços realizados
                          </p>
                        </div>
                      );
                    })()}
                    {profPublico.especialidades && profPublico.especialidades.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {profPublico.especialidades.slice(0, 3).map((e: string) => (
                          <span key={e} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
                            {e}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full rounded-full h-12 font-bold mt-4"
                  onClick={() => setShowConversar(true)}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Conversar
                </Button>
              </section>
            )}
            {concluido && sp.profissional_id && (
              <section className="bg-white rounded-[2rem] border border-amber-100 p-6 md:p-8 shadow-soft">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" />
                  Como foi o serviço?
                </h3>
                <AvaliacaoForm
                  orcamentoId={sp.id}
                  clienteId={sp.cliente_id}
                  profissionalId={sp.profissional_id}
                />
                {jaAvaliou && (
                  <button
                    onClick={() => setActiveTab("servicos" as Tab)}
                    className="mt-4 text-sm text-brand hover:underline font-medium"
                  >
                    Ver no Histórico de Serviços →
                  </button>
                )}
              </section>
            )}
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
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3">
                    Profissional que enviou a proposta
                  </p>
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar className="h-16 w-16 rounded-xl shrink-0">
                      {profPublico?.foto_url ? (
                        <AvatarImage src={profPublico.foto_url} alt={primeiraProposta.profNome || "Profissional"} className="rounded-xl object-cover" />
                      ) : null}
                      <AvatarFallback className="rounded-xl bg-brand-soft text-brand font-bold text-lg">
                        {String(primeiraProposta.profNome || "P").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg leading-tight">{primeiraProposta.profNome || "Profissional"}</p>
                      {profPublico?.aprovacao_status === "aprovado" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-0.5 mt-1">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Identidade verificada
                        </span>
                      )}
                      {(profPublico?.cidade || profPublico?.anos_experiencia) && (
                        <p className="text-xs text-slate-500 mt-1">
                          {profPublico?.cidade ? profPublico.cidade : null}
                          {profPublico?.cidade && profPublico?.anos_experiencia ? " · " : null}
                          {profPublico?.anos_experiencia ? `${profPublico.anos_experiencia} anos de experiência` : null}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 mb-3">
                    <NivelBadge concluidos={primeiraProposta.profConcluidos || 0} notaMedia={Number(primeiraProposta.profMedia) || 0} compact />
                    <p className="text-xs text-slate-500 font-medium">
                      {primeiraProposta.profTotalAvaliacoes > 0 ? (
                        <>⭐ {primeiraProposta.profMedia} ({primeiraProposta.profTotalAvaliacoes} avaliações)</>
                      ) : "Novo na plataforma"}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      {primeiraProposta.profConcluidos || 0} serviços realizados
                    </p>
                  </div>

                  {profPublico?.especialidades && profPublico.especialidades.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {profPublico.especialidades.slice(0, 4).map((e: string) => (
                        <span key={e} className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                          {e}
                        </span>
                      ))}
                    </div>
                  )}

                  {profPublico?.bio && (
                    <p className="text-sm text-slate-600 mb-3 line-clamp-3">{profPublico.bio}</p>
                  )}

                  {(primeiraProposta.profSlug || profPublico?.slug) && (
                    <a
                      href={`/profissionais/perfil/${primeiraProposta.profSlug || profPublico?.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand hover:underline inline-block mb-2 font-semibold"
                    >
                      Ver perfil completo e avaliações →
                    </a>
                  )}

                  {primeiraProposta.observacoes && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                        Mensagem do profissional
                      </p>
                      <p className="text-sm text-slate-700">
                        {primeiraProposta.observacoes}
                      </p>
                    </div>
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
                {pagoOuAgendado && sp.lastPagamento?.confirmacao_profissional_em && !sp.lastPagamento?.confirmacao_cliente_em && (
                  <div className="mb-4 p-4 rounded-xl border border-blue-200 bg-blue-50 animate-pulse">
                    <p className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Profissional marcou o serviço como concluído
                    </p>
                    <p className="text-xs text-blue-700 mb-3">
                      Confirme a conclusão para liberar o repasse ao profissional. O débito será efetuado no seu cartão.
                    </p>
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-md"
                      disabled={isCapturing === sp.id}
                      onClick={() => handleCapture(sp.id)}
                    >
                      {isCapturing === sp.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Confirmar conclusão do serviço
                    </Button>
                  </div>
                )}
                {pagoOuAgendado && (
                  <>
                    <h3 className="text-xl font-bold mb-2">Serviço em andamento</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Combine os detalhes finais com o profissional pelo chat.
                    </p>
                  </>
                )}
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
                <div className="flex flex-col gap-1 text-center">
                  <Button
                    variant="outline"
                    className="rounded-full h-12 font-bold"
                    onClick={() => {
                      const idCurto = sp.id.slice(0, 8);
                      window.location.href = `mailto:suporte@maridopraque.com?subject=Dúvida sobre pedido ${idCurto}&body=Olá, preciso de ajuda com meu pedido ${idCurto}.%0A%0A`;
                    }}
                  >
                    Suporte
                  </Button>
                  <p className="text-[10px] text-slate-400 font-medium pt-1">
                    Ou escreva direto para <span className="select-all">suporte@maridopraque.com</span>
                  </p>
                </div>

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
                      onClick={initBrick}
                      className="flex-1 bg-brand text-white rounded-full h-13 font-bold shadow-lg hover:scale-[1.02] transition-transform"
                    >
                      Aceitar proposta
                    </Button>
                  </div>
                </div>
              )}

              {approvalStep === "processing" && (
                <div className="p-8 md:p-10">
                  <h3 className="text-2xl font-bold mb-4 text-center">Reserva do Cartão</h3>
                  <p className="text-muted-foreground text-sm text-center mb-6">
                    Seu cartão será reservado agora, mas o débito só acontece após você confirmar a conclusão do serviço.
                  </p>
                  
                  {brickError && (
                    <div className="p-4 mb-4 text-sm text-red-600 bg-red-50 rounded-lg text-center font-medium">
                      {brickError}
                    </div>
                  )}

                  {!brickConfig && !brickError && (
                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-brand" />
                      <p className="text-sm font-bold">Carregando ambiente seguro...</p>
                    </div>
                  )}

                  <div className="min-h-[200px]" id="payment-brick-container" />

                  {isProcessingPayment && (
                    <div className="flex items-center justify-center gap-2 mt-4 text-brand font-bold text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando autorização...
                    </div>
                  )}

                  <div className="mt-6 text-center">
                    <Button variant="ghost" onClick={() => setApprovalStep(null)} disabled={isProcessingPayment} className="rounded-full">
                      Cancelar
                    </Button>
                  </div>
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
                      onClick={() => {
                        setApprovalStep(null);
                        queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos", user?.id] });
                        queryClient.refetchQueries({ queryKey: ["cliente", "pedidos", user?.id] });
                      }}
                      className="w-full bg-brand text-white rounded-full h-14 font-bold shadow-lg"
                    >
                      Avançar
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
      {filteredPedidos.some((p) => p.lastPagamento?.status_autorizacao === "falhou") && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-4">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-red-800">Pagamento Pendente</h4>
            <p className="text-sm text-red-700 mt-1">
              Houve uma falha na cobrança do seu cartão para um serviço já realizado.
              Regularize o pagamento para evitar o bloqueio da sua conta.
            </p>
            {filteredPedidos.filter(p => p.lastPagamento?.status_autorizacao === "falhou").map(p => (
              p.lastPagamento?.metadata?.link_pagamento_avulso && (
                <a
                  key={p.id}
                  href={p.lastPagamento.metadata.link_pagamento_avulso}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors shadow-sm"
                >
                  Pagar Recobrança ({p.title})
                </a>
              )
            ))}
          </div>
        </div>
      )}

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
                      isDeleting === p.id || ["pago", "concluido", "cancelado", "em_disputa"].includes(String(p.rawStatus || "").toLowerCase())
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


