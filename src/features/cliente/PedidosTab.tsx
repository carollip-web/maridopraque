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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { aceitarProposta, cancelarPedido } from "@/lib/orcamentos.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SlotPicker } from "@/components/SlotPicker";
import { Chat } from "@/components/Chat";
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
  const [selectedProposta, setSelectedProposta] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDeleteOrder = async (orderId: string, title: string) => {
    if (!confirm(`Tem certeza que deseja cancelar o pedido "${title}"?`)) return;

    setIsDeleting(orderId);
    try {
      if (pedidoId === orderId) {
        await navigate({
          to: "/cliente",
          search: (prev: any) => ({ ...prev, pedidoId: undefined, chat: undefined }),
        });
      }

      const { ok, error: serverError } = await cancelarPedidoFn({
        data: { orcamentoId: orderId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!ok) throw new Error(serverError || "Erro ao cancelar");

      toast.success("Pedido cancelado com sucesso.");

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
        .select("*")
        .eq("cliente_id", user.id)
        .order("created_at", { ascending: false });

      if (error) console.error("Error fetching orcamentos:", error);

      const list = data || [];

      const orcIds = list.map((o) => o.id);
      let propostas: any[] = [];
      const profsMap: Record<string, string> = {};
      if (orcIds.length > 0) {
        const { data: pData } = await (supabase as any)
          .from("propostas")
          .select("*")
          .in("orcamento_id", orcIds);
        propostas = pData || [];
        const profIds = Array.from(new Set(propostas.map((p) => p.profissional_id)));
        if (profIds.length > 0) {
          const { data: prData } = await supabase
            .from("profiles")
            .select("id, nome")
            .in("id", profIds);
          (prData || []).forEach((p) => (profsMap[p.id] = p.nome));
        }
      }

      return list.map((o) => {
        const propsForOrc = propostas
          .filter((p) => p.orcamento_id === o.id)
          .map((p) => ({ ...p, profNome: profsMap[p.profissional_id] || "Profissional" }));
        const uiStatus =
          o.status === "customizado_pendente" && propsForOrc.length > 0
            ? "Aguardando Aprovação"
            : o.status === "customizado_pendente"
              ? "Em Análise"
              : o.status === "enviado"
                ? "Aguardando Aprovação"
                : o.status === "fixo_auto"
                  ? "Aprovação Automática"
                  : o.status === "aprovado"
                    ? "Aguardando Pagamento"
                  : o.status === "pago"
                    ? "Agendado"
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
          price: o.valor ? `R$ ${Number(o.valor).toFixed(2)}` : "A definir",
          displayPrice: o.valor ? `R$ ${Number(o.valor).toFixed(2)}` : "A definir",
        };
      });
    },
    enabled: !!user,
  });

  const filters = ["Todos", "Agendado", "Em Análise", "Aguardando Aprovação"];


  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel("cliente-pedidos-realtime")
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "orcamentos",
        filter: `cliente_id=eq.${user.id}`
      }, async () => {
        console.info("[PedidosTab] Realtime Update - orcamentos", { userId: user.id });
        queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos", user.id] });
        await queryClient.refetchQueries({ queryKey: ["cliente", "pedidos", user.id] });
      })
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "propostas"
      }, async () => {
        console.info("[PedidosTab] Realtime Update - propostas");
        queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos", user.id] });
        await queryClient.refetchQueries({ queryKey: ["cliente", "pedidos", user.id] });
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const handleApprove = async () => {
    if (!selectedPedido) return;
    setApprovalStep("processing");
    try {
      if (selectedProposta) {
        await aceitarPropostaFn({
          data: { orcamentoId: selectedPedido.id, propostaId: selectedProposta.id },
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });

        if (dataAgendada) {
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
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <button
          onClick={closePedido}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-brand transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar para pedidos
        </button>

        <section className="bg-white rounded-[2.5rem] border border-border p-8 md:p-12 shadow-soft">
          <div className="flex flex-col md:flex-row justify-between gap-8 mb-12">
            <div className="flex items-start gap-6">
              <div
                className={`h-20 w-20 rounded-3xl flex items-center justify-center font-bold text-xl shrink-0 ${
                  sp.status === "Agendado"
                    ? "bg-blue-50 text-blue-600"
                    : sp.status === "Em Análise"
                      ? "bg-slate-100 text-slate-600"
                      : "bg-amber-50 text-amber-600"
                }`}
              >
                {sp.id.slice(0, 4)}
              </div>
              <div>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block mb-3 ${
                    sp.status === "Agendado"
                      ? "bg-green-100 text-green-700"
                      : sp.status === "Em Análise"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {sp.status}
                </span>
                <h2 className="text-3xl font-bold">{sp.title}</h2>
                <p className="text-muted-foreground mt-2">{sp.description}</p>
                {(sp as any).tipo_atendimento && (
                  <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-soft/20 text-brand w-fit mt-3">
                    <User className="h-3.5 w-3.5" />
                    Atendimento: {
                      (sp as any).tipo_atendimento === "mulher" ? "Profissional mulher" :
                      (sp as any).tipo_atendimento === "homem" ? "Profissional homem" : 
                      "Profissional + apoio feminino"
                    }
                  </div>
                )}
                {(sp as any).data_preferida && (
                  <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 w-fit mt-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Agenda: {new Date((sp as any).data_preferida + 'T00:00:00').toLocaleDateString('pt-BR')}
                    {" · "}
                    {(sp as any).periodo_preferido === 'manha' && 'Manhã'}
                    {(sp as any).periodo_preferido === 'tarde' && 'Tarde'}
                    {(sp as any).periodo_preferido === 'noite' && 'Noite'}
                    {(sp as any).periodo_preferido === 'horario_especifico' && (sp as any).horario_preferido?.slice(0, 5)}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">
                Investimento
              </p>
              <p className="text-3xl font-bold text-slate-800">{sp.price}</p>
            </div>
          </div>

          <div className="grid gap-12 lg:grid-cols-2">
            <div className="space-y-8">
              <div className="space-y-4">
                <h4 className="font-bold text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-brand" /> Timeline do Pedido
                </h4>
                <div className="space-y-6 pl-4 border-l-2 border-slate-100">
                  <div className="relative pl-6">
                    <div className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full bg-brand border-4 border-white shadow-sm" />
                    <p className="text-sm font-bold">Pedido solicitado</p>
                    <p className="text-xs text-muted-foreground">{sp.date}</p>
                  </div>
                  {sp.status !== "Em Análise" && (
                    <div className="relative pl-6">
                      <div className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full bg-brand border-4 border-white shadow-sm" />
                      <p className="text-sm font-bold">Orçamento enviado</p>
                      <p className="text-xs text-muted-foreground">Há 1 dia</p>
                    </div>
                  )}
                  {sp.status === "Agendado" && (
                    <div className="relative pl-6">
                      <div className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full bg-green-500 border-4 border-white shadow-sm" />
                      <p className="text-sm font-bold">Serviço agendado ✓</p>
                      <p className="text-xs text-muted-foreground">{sp.date}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Proposals Received Section */}
              {(sp.status === "Aguardando Aprovação" || sp.status === "Em Análise") &&
                sp.propostas &&
                sp.propostas.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-brand" /> Propostas Recebidas
                    </h4>
                    <div className="grid gap-4">
                      {sp.propostas.map((prop: any) => (
                        <div
                          key={prop.id}
                          className="p-6 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-slate-200" />
                            <div>
                              <p className="font-bold">{prop.profNome}</p>
                              {prop.observacoes && (
                                <p className="text-xs text-muted-foreground">"{prop.observacoes}"</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                                Valor
                              </p>
                              <p className="font-bold text-slate-800">
                                R$ {Number(prop.valor_servico).toFixed(2)}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              className="rounded-full bg-brand text-white font-bold px-6"
                              onClick={() => {
                                setSelectedProposta(prop);
                                setDataAgendada(null);
                                setApprovalStep("schedule");
                              }}
                            >
                              Aceitar Proposta
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            <div className="space-y-6">
              {sp.prof !== "-" && (
                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                    Profissional Responsável
                  </h4>
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-slate-200" />
                    <div>
                      <p className="font-bold">{sp.prof}</p>
                      <p className="text-xs text-muted-foreground">Especialista em Manutenção</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto rounded-full text-xs font-bold hover:bg-slate-100"
                      onClick={() => setShowConversar(true)}
                    >
                      Conversar
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-4">
                {sp.status === "Aguardando Aprovação" && (
                  <Button
                    className="flex-1 bg-brand text-white rounded-full font-bold h-12 shadow-lg hover:scale-[1.02] transition-transform"
                    onClick={() => {
                      setDataAgendada(null);
                      setApprovalStep(sp.profissional_id ? "schedule" : "confirm");
                    }}
                  >
                    Aprovar Orçamento
                  </Button>
                )}
                {(sp.status === "Agendado" || sp.status === "Aprovado") && (
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full font-bold h-12"
                    onClick={async () => {
                      const { toast } = await import("sonner");
                      toast.success("Pedido de reagendamento enviado ao profissional");
                    }}
                  >
                    Solicitar Reagendamento
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1 rounded-full font-bold h-12"
                  onClick={() => window.open(WHATSAPP_LINK, "_blank")}
                >
                  Suporte
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-full font-bold h-12"
                  onClick={async () => {
                    try {
                      await gerarPdfOrcamento(sp.id);
                    } catch (e: any) {
                      toast.error(e?.message || "Erro ao gerar PDF");
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" /> Baixar PDF
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-full font-bold h-12 text-red-500 hover:bg-red-50 hover:border-red-200"
                  disabled={
                    isDeleting === sp.id || ["pago", "concluido"].includes(sp.status.toLowerCase())
                  }
                  onClick={() => handleDeleteOrder(sp.id, sp.title)}
                >
                  {isDeleting === sp.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Cancelar Pedido
                </Button>
              </div>
            </div>
          </div>
        </section>

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
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Button
                      variant="outline"
                      onClick={() => window.open(WHATSAPP_LINK, "_blank")}
                      className="rounded-full text-xs"
                    >
                      <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => (window.location.href = "tel:21999999999")}
                      className="rounded-full text-xs"
                    >
                      <Phone className="h-3 w-3 mr-1" /> Ligar
                    </Button>
                  </div>
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
                    <h3 className="text-2xl font-bold">Confirmar Aprovação</h3>
                    <p className="text-muted-foreground mt-2 text-sm">
                      Revise o orçamento antes de confirmar
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 space-y-4 mb-8">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Serviço</span>
                      <span className="font-bold">{sp.title}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Profissional</span>
                      <span className="font-bold">{sp.prof}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Mão de obra</span>
                      <span className="font-bold">R$ 420,00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa de visita</span>
                      <span className="font-bold">R$ 30,00</span>
                    </div>
                    {dataAgendada && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Agendado para</span>
                        <span className="font-bold">
                          {dataAgendada.toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    )}
                    <div className="pt-3 border-t border-slate-200 flex justify-between">
                      <span className="font-bold text-brand">Total</span>
                      <span className="font-bold text-brand text-lg">{sp.price}</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center mb-8 leading-relaxed">
                    Ao aprovar, você concorda com os termos do serviço. O profissional será
                    notificado imediatamente.
                  </p>

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
                      ✓ Confirmar Aprovação
                    </Button>
                  </div>
                </div>
              )}

              {approvalStep === "processing" && (
                <div className="p-12 text-center">
                  <div className="relative h-24 w-24 mx-auto mb-8">
                    <div className="absolute inset-0 rounded-full border-4 border-brand/20" />
                    <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
                    <div className="absolute inset-3 rounded-full bg-brand/10 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-brand animate-pulse" />
                    </div>
                  </div>
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
                  <p className="text-muted-foreground text-sm mb-2">
                    <span className="font-bold text-slate-700">{sp.prof}</span> foi notificado e seu
                    pedido está pronto para o pagamento.
                  </p>
                  <div className="bg-green-50 rounded-2xl p-4 my-6 text-left space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-800">
                        Status atualizado → <strong>Aguardando Pagamento</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-800">
                        Próximo passo: pagamento do sinal (50%)
                      </span>
                    </div>
                  </div>
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
                  {(p.rawStatus === "enviado" || p.status === "Aguardando Aprovação") && (
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
