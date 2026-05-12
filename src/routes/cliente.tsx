import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Wrench, 
  CreditCard, 
  MapPin, 
  User, 
  History, 
  ChevronRight, 
  ChevronLeft, 
  Search,
  Bell,
  Settings,
  LogOut,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Plus,
  Camera,
  ShieldCheck,
  X,
  MessageCircle,
  Phone,
  Filter,
  ChevronDown,
  Download
} from "lucide-react";
import { gerarPdfOrcamento } from "@/lib/pdf-orcamento";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { aceitarProposta } from "@/lib/orcamentos.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { SlotPicker } from "@/components/SlotPicker";
import { toast } from "sonner";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import { AvaliacaoForm } from "@/components/AvaliacaoForm";
import { Chat } from "@/components/Chat";
import { IndicacaoCard } from "@/components/IndicacaoCard";

export const Route = createFileRoute("/cliente")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as Tab) || "inicio",
      id: search.id != null ? String(search.id) : undefined,
      pedidoId: search.pedidoId != null ? String(search.pedidoId) : undefined,
      chat: search.chat != null ? String(search.chat) : undefined,
      details: search.details === "true" || search.details === true,
    };
  },
  component: ClienteArea,
});

type Tab = "inicio" | "pedidos" | "servicos" | "pagamentos" | "dados" | "notificacoes";

function ClienteArea() {
  const { tab: activeTab } = Route.useSearch();
  const { logout, userData, isProfissional, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const setActiveTab = (newTab: Tab) => {
      navigate({ 
        to: "/cliente", 
        search: (prev: any) => ({ tab: newTab, id: undefined, pedidoId: undefined, chat: undefined, details: false })
      });
  };

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  const sidebarItems = [
    { id: "inicio", label: "Meu Painel", icon: LayoutDashboard },
    { id: "pedidos", label: "Pedidos e Orçamentos", icon: ClipboardList },
    { id: "servicos", label: "Histórico de Serviços", icon: History },
    { id: "pagamentos", label: "Pagamentos", icon: CreditCard },
    { id: "notificacoes", label: "Notificações", icon: Bell },
    { id: "dados", label: "Meus Dados", icon: User },
  ].filter(item => {
    // Se for profissional, limitamos a visão da "Minha Conta" para não confundir com o Painel Profissional
    // Mantemos apenas Notificações e Meus Dados por padrão, a menos que eles explicitamente usem as outras abas.
    if ((isProfissional || isAdmin) && ["inicio", "pedidos", "servicos", "pagamentos"].includes(item.id)) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (!user) return;

    console.log("[ClienteArea] Subscribing to realtime for user:", user.id);
    const channel = supabase
      .channel(`cliente-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orcamentos",
          filter: `cliente_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Realtime update: orcamentos changed", payload);
          queryClient.invalidateQueries({ queryKey: ["cliente"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "propostas",
        },
        (payload) => {
          console.log("Realtime update: propostas changed", payload);
          queryClient.invalidateQueries({ queryKey: ["cliente"] });
        }
      )
      .subscribe();

    return () => {
      console.log("[ClienteArea] Unsubscribing from realtime");
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-border shrink-0 z-20">
        <div className="p-8 hidden md:block">
           <span className="text-xs font-bold uppercase tracking-widest text-brand">
             {(isProfissional || isAdmin) ? "Sua Conta" : "Área do Cliente"}
           </span>
        </div>
        
        <nav className="p-4 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id 
                ? "bg-brand text-brand-foreground shadow-brand-soft" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="w-full md:hidden flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
        </nav>

        <div className="mt-auto p-4 border-t border-border hidden md:block">
           <button 
             onClick={handleLogout}
             className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
           >
             <LogOut className="h-4 w-4" />
             Sair da conta
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 max-w-6xl mx-auto w-full relative">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm pt-4 pb-4 -mx-4 px-4 md:-mx-10 md:px-10 border-b border-border/50">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {sidebarItems.find(i => i.id === activeTab)?.label || "Minha Conta"}
            </h1>
            <p className="text-muted-foreground mt-1">Bem-vindo(a) de volta, {userData?.name?.split(" ")[0] || "Usuário"}!</p>
          </div>
        </header>

        {activeTab === "inicio" && <DashboardTab setActiveTab={setActiveTab} />}
        {activeTab === "pedidos" && <PedidosTab setActiveTab={setActiveTab} />}
        {activeTab === "servicos" && <ServicosTab />}
        {activeTab === "pagamentos" && <PagamentosTab />}
        {activeTab === "notificacoes" && <NotificacoesTab setActiveTab={setActiveTab} />}
        {activeTab === "dados" && <DadosTab />}
      </main>
    </div>
  );
}

function NotificacoesTab({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const { id, details } = Route.useSearch();
  const navigate = useNavigate();

  const selectedId = id ? String(id) : null;
  const selectedNotification = selectedId != null ? notifications.find(n => n.id === selectedId) : null;
  const showFullDetails = details === true;

  useEffect(() => {
    if (selectedId != null) {
      markAsRead(selectedId);
    }
  }, [selectedId]);

  const openNotification = (notifId: string) => {
    markAsRead(notifId);
    navigate({ to: "/cliente", search: (prev: any) => ({ ...prev, id: String(notifId), details: undefined }) });
  };

  const handleBackToList = () => {
    navigate({ to: "/cliente", search: (prev: any) => ({ ...prev, id: undefined, details: undefined }) });
  };

  const openFullDetails = () => {
    navigate({ to: "/cliente", search: (prev: any) => ({ ...prev, details: true }) });
  };

  const closeFullDetails = () => {
    navigate({ to: "/cliente", search: (prev: any) => ({ ...prev, details: undefined }) });
  };

  if (selectedNotification) {
    if (showFullDetails) {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          <button 
            onClick={closeFullDetails}
            className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-brand transition-colors mb-4"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar para a mensagem
          </button>

          <div className="bg-white rounded-[2rem] border border-border p-8 md:p-12 shadow-soft">
            <h3 className="text-2xl font-bold text-slate-800 mb-8">Detalhamento Completo</h3>
            
            <div className="space-y-10">
              <div className="grid gap-8 md:grid-cols-2">
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resumo do Serviço</p>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Tipo:</span>
                      <span className="text-sm font-bold">{selectedNotification.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Protocolo:</span>
                      <span className="text-sm font-bold">#2026-0{selectedNotification.id}X-88</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Data Solicitação:</span>
                      <span className="text-sm font-bold">{selectedNotification.time}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Financeiro</p>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Mão de Obra:</span>
                      <span className="text-sm font-bold">R$ 120,00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Taxa de Visita:</span>
                      <span className="text-sm font-bold">R$ 30,00</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between">
                      <span className="text-sm font-bold text-brand">Total Estimado:</span>
                      <span className="text-sm font-bold text-brand">R$ 150,00</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Histórico de Alterações</p>
                 <div className="space-y-4">
                    {[
                      { date: "Hoje, 14:00", text: "Orçamento aprovado pelo profissional" },
                      { date: "Ontem, 09:30", text: "Profissional Ricardo M. aceitou o chamado" },
                      { date: "Ontem, 08:00", text: "Pedido registrado no sistema" },
                    ].map((h, i) => (
                      <div key={i} className="flex gap-4 items-start">
                         <div className="h-2 w-2 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                         <div>
                            <p className="text-sm font-medium text-slate-700">{h.text}</p>
                            <p className="text-[10px] text-muted-foreground">{h.date}</p>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border">
               <Button 
                 onClick={() => setActiveTab("pedidos")}
                 className="bg-brand text-white rounded-full px-8 font-bold h-12 shadow-lg"
               >
                 Acessar Central de Pedidos
               </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <button 
          onClick={handleBackToList}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-brand transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar para notificações
        </button>

        <div className="bg-white rounded-[2rem] border border-border p-8 md:p-12 shadow-soft">
          <div className="flex items-center justify-between mb-8">
            <div className="h-14 w-14 rounded-2xl bg-[#fefaf9] flex items-center justify-center">
              <Bell className="h-7 w-7 text-[#b85c45]" />
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{selectedNotification.time}</p>
          </div>

          <h3 className="text-2xl font-bold text-slate-800 mb-4">{selectedNotification.title}</h3>
          <div className="prose prose-slate max-w-none">
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              {selectedNotification.desc}
            </p>
            
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest text-[10px]">Informações Adicionais</p>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Protocolo</p>
                  <p className="text-sm font-bold">#2026-0{selectedNotification.id}X-88</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Ação Necessária</p>
                  <button 
                    onClick={openFullDetails}
                    className="text-sm font-bold text-brand hover:underline block text-left"
                  >
                    Ver detalhes completos
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={() => {
                if (selectedNotification.pedidoId) {
                  navigate({ to: "/cliente", search: () => ({ tab: "pedidos" as Tab, pedidoId: selectedNotification.pedidoId, id: undefined, chat: undefined, details: false }) });
                } else {
                  setActiveTab("pedidos");
                }
              }}
              className="bg-[#1a1513] text-white rounded-full px-8 font-bold h-12 shadow-lg hover:scale-[1.02] transition-transform"
            >
              Ir para o Serviço
            </Button>
            <Button variant="outline" className="rounded-full px-8 font-bold h-12 border-border" onClick={handleBackToList}>Marcar como resolvido</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Notificações</h3>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-[#b85c45] font-bold text-xs hover:bg-[#b85c45]/10 px-2" onClick={markAllAsRead}>
            Marcar todas como lidas
          </Button>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-border shadow-soft divide-y divide-border overflow-hidden">
        {notifications.length === 0 ? (
           <div className="p-12 text-center text-muted-foreground font-medium">Você não tem nenhuma notificação no momento.</div>
        ) : (
           notifications.map((n) => (
             <div 
               key={n.id} 
               onClick={() => openNotification(n.id)}
               className={`p-6 md:p-8 flex gap-5 transition-all cursor-pointer group hover:bg-slate-50 ${n.read ? "bg-white" : "bg-[#fefaf9]"}`}
             >
                <div className="mt-1.5 shrink-0">
                   <div className={`h-2.5 w-2.5 rounded-full transition-colors ${n.read ? "bg-slate-200" : "bg-[#b85c45]"}`} />
                </div>
                <div className="flex-1">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <p className={`text-base font-bold transition-colors ${n.read ? "text-slate-700" : "text-[#b85c45] group-hover:text-brand"}`}>{n.title}</p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{n.time}</p>
                   </div>
                   <p className="text-sm text-muted-foreground leading-relaxed md:max-w-2xl group-hover:text-slate-600 transition-colors">{n.desc}</p>
                   
                   {!n.read && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-[#b85c45] mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        Clique para abrir →
                      </span>
                   )}
                </div>
             </div>
           ))
        )}
      </div>
    </div>
  );
}

function DashboardTab({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const [showBanner, setShowBanner] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["cliente", "stats", user?.id],
    queryFn: async () => {
      if (!user) return { concluidos: 0, ativos: 0, pendentes: 0, total: 0, recentes: [] as any[] };
      const { data, error } = await supabase
        .from("orcamentos")
        .select("status, valor, service_name, created_at")
        .eq("cliente_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) console.error("Error fetching stats orcamentos:", error);
        console.log("Dashboard stats for user", user.id, ":", data);
      
      const list = data || [];
      return {
        concluidos: list.filter(o => o.status === "pago").length,
        ativos: list.filter(o => ["aprovado", "enviado", "fixo_auto"].includes(o.status)).length,
        pendentes: list.filter(o => o.status === "customizado_pendente").length,
        total: list.filter(o => o.status === "pago").reduce((acc, o) => acc + (o.valor || 0), 0),
        recentes: list.slice(0, 3),
      };
    },
    enabled: !!user,
  });

  const statsItems = [
    { label: "Serviços Realizados", value: stats?.concluidos ?? "0", icon: CheckCircle2, color: "text-green-600", tab: "servicos" as const },
    { label: "Pedidos Ativos", value: stats?.ativos ?? "0", icon: Clock, color: "text-[#b85c45]", tab: "pedidos" as const },
    { label: "Orçamentos Pendentes", value: stats?.pendentes ?? "0", icon: AlertCircle, color: "text-amber-500", tab: "pedidos" as const },
    { label: "Total Investido", value: `R$ ${stats?.total.toFixed(0) ?? "0"}`, icon: CreditCard, color: "text-slate-600", tab: "pagamentos" as const },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-border shadow-soft space-y-4">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))
        ) : (
          statsItems.map((stat) => (
            <div 
              key={stat.label} 
              className="bg-white p-6 rounded-3xl border border-border shadow-soft hover:shadow-md hover:border-brand/20 transition-all cursor-pointer group"
              onClick={() => setActiveTab(stat.tab)}
            >
              <div className={`h-11 w-11 rounded-full bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-brand/10 transition-colors`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-sm font-medium text-muted-foreground group-hover:text-brand transition-colors">{stat.label}</p>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
            </div>
          ))
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* Recent Activity */}
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold">Atividade Recente</h2>
            <button className="text-sm font-semibold text-brand hover:underline" onClick={() => setActiveTab("pedidos")}>Ver tudo</button>
          </div>
          <div className="space-y-6">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-4 w-4" />
                </div>
              ))
            ) : (
              (stats?.recentes || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhuma atividade recente.</p>
              ) : (
                stats?.recentes.map((item: any, i: number) => {
                  const isConcluido = item.status === "pago";
                  const isOrcamento = item.status === "customizado_pendente";
                  const isFixo = item.status === "fixo_auto";
                  return (
                    <div 
                      key={i} 
                      className="flex items-center gap-4 group cursor-pointer" 
                      onClick={() => setActiveTab(isConcluido ? "servicos" : "pedidos")}
                    >
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                        isConcluido ? "bg-green-50 text-green-600" : 
                        (isOrcamento || isFixo) ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                      }`}>
                        {isConcluido ? <CheckCircle2 className="h-5 w-5" /> : 
                         (isOrcamento || isFixo) ? <FileText className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold group-hover:text-brand transition-colors">{item.service_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {isConcluido ? "Concluído" : (isOrcamento || isFixo) ? "Aguardando orçamento" : "Em andamento"} • {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </div>
                  );
                })
              )
            )}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="space-y-6">
           {showBanner && (
             <div className="bg-foreground text-background rounded-[2rem] p-8 shadow-xl relative overflow-hidden animate-in fade-in zoom-in duration-300">
                <button 
                  onClick={() => setShowBanner(false)}
                  className="absolute right-6 top-6 z-10 p-2 rounded-full bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
                <Plus className="absolute -right-4 -top-4 h-32 w-32 text-white/10 rotate-12" />
                <h3 className="text-xl font-bold mb-2">Novo Serviço?</h3>
                <p className="text-sm text-white/70 mb-6">Solicite um novo orçamento agora pela plataforma.</p>
                <Button 
                  onClick={() => navigate({ to: "/servicos" })}
                  className="w-full rounded-full bg-brand text-brand-foreground hover:bg-brand/90 font-bold"
                >
                   Solicitar Agora
                </Button>
             </div>
           )}
           
           <IndicacaoCard />

           <div className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
              <h3 className="font-bold mb-4">Dica de Segurança</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Lembre-se: todos os nossos profissionais usam uniforme e crachá com QR Code de verificação.
              </p>
           </div>
        </section>
      </div>
    </div>
  );
}

function PedidosTab({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const { pedidoId, chat } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showConversar, setShowConversar] = useState(false);
  const [approvalStep, setApprovalStep] = useState<null | "schedule" | "confirm" | "processing" | "success">(null);
  const [dataAgendada, setDataAgendada] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const aceitarPropostaFn = useServerFn(aceitarProposta);
  const [selectedProposta, setSelectedProposta] = useState<any>(null);

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
      console.log("Fetched orcamentos for user", user.id, ":", data);
      
      const list = data || [];
      
      const orcIds = list.map(o => o.id);
      let propostas: any[] = [];
      let profsMap: Record<string, string> = {};
      if (orcIds.length > 0) {
        const { data: pData } = await (supabase as any).from("propostas").select("*").in("orcamento_id", orcIds);
        propostas = pData || [];
        const profIds = Array.from(new Set(propostas.map(p => p.profissional_id)));
        if (profIds.length > 0) {
           const { data: prData } = await supabase.from("profiles").select("id, nome").in("id", profIds);
           (prData || []).forEach(p => profsMap[p.id] = p.nome);
        }
      }

      // Normalize statuses for the UI filters
      return list.map(o => {
        const propsForOrc = propostas.filter(p => p.orcamento_id === o.id).map(p => ({...p, profNome: profsMap[p.profissional_id] || "Profissional"}));
        const uiStatus = (o.status === "customizado_pendente" && propsForOrc.length > 0) ? "Aguardando Aprovação" :
                 o.status === "customizado_pendente" ? "Em Análise" :
                 (o.status === "enviado" || o.status === "fixo_auto") ? "Aguardando Aprovação" :
                 o.status === "aprovado" ? "Agendado" : o.status;
        return {
          propostas: propsForOrc,
          ...o,
          title: o.service_name,
          description: o.descricao ?? "",
          uiStatus,
          status: uiStatus as string,
          date: new Date(o.created_at).toLocaleDateString(),
          prof: "-",
          price: o.valor ? `R$ ${Number(o.valor).toFixed(2)}` : "A definir",
          displayPrice: o.valor ? `R$ ${Number(o.valor).toFixed(2)}` : "A definir",
        };
      });
    },
    enabled: !!user,
  });

  const filters = ["Todos", "Agendado", "Em Análise", "Aguardando Aprovação"];
  const WHATSAPP = "https://wa.me/5521999999999?text=Olá!%20Quero%20falar%20sobre%20meu%20pedido.";

  // Simple in-memory store for pedido status updates
  const [pedidoStatuses, setPedidoStatuses] = useState<Record<string, string>>({});

  const getPedidoStatus = (id: string, defaultStatus: string) =>
    pedidoStatuses[id] ?? defaultStatus;

  const handleApprove = async () => {
    if (!selectedPedido) return;
    setApprovalStep("processing");
    try {
      if (selectedProposta) {
        await aceitarPropostaFn({ data: { orcamentoId: selectedPedido.id, propostaId: selectedProposta.id } });
        if (dataAgendada) {
          await supabase.from("orcamentos").update({ data_agendada: dataAgendada.toISOString() }).eq("id", selectedPedido.id);
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

    setPedidoStatuses(prev => ({ ...prev, [selectedPedido.id]: "Agendado" }));
    queryClient.invalidateQueries({ queryKey: ["cliente", "pedidos"] });
    setApprovalStep("success");
  };

  const selectedPedido = pedidoId ? pedidos.find(p => p.id === pedidoId) : null;
  const selectedPedidoWithStatus = selectedPedido
    ? { ...selectedPedido, status: getPedidoStatus(selectedPedido.id, selectedPedido.status) }
    : null;

  useEffect(() => {
    if (chat === "1" && selectedPedido?.profissional_id) {
      setShowConversar(true);
    }
  }, [chat, selectedPedido?.id, selectedPedido?.profissional_id]);

  const openPedido = (id: string) => {
    navigate({ to: "/cliente", search: (prev: any) => ({ ...prev, pedidoId: id }) });
  };

  const closePedido = () => {
    navigate({ to: "/cliente", search: (prev: any) => ({ ...prev, pedidoId: undefined, chat: undefined }) });
  };

  const closeConversar = () => {
    setShowConversar(false);
    navigate({ to: "/cliente", search: (prev: any) => ({ ...prev, chat: undefined }) });
  };

  const filteredPedidos = pedidos.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "Todos" || p.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  if (selectedPedidoWithStatus) {
    const sp = selectedPedidoWithStatus;
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
                 <div className={`h-20 w-20 rounded-3xl flex items-center justify-center font-bold text-xl shrink-0 ${
                    sp.status === "Agendado" ? "bg-blue-50 text-blue-600" : 
                    sp.status === "Em Análise" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-600"
                 }`}>
                    {sp.id}
                 </div>
                 <div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block mb-3 ${
                      sp.status === "Agendado" ? "bg-green-100 text-green-700" : 
                      sp.status === "Em Análise" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"
                    }`}>
                      {sp.status}
                    </span>
                    <h2 className="text-3xl font-bold">{sp.title}</h2>
                    <p className="text-muted-foreground mt-2">{sp.description}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Investimento</p>
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
              </div>

              <div className="space-y-6">
                 {sp.prof !== "-" && (
                    <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                       <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Profissional Responsável</h4>
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
                         onClick={() => { setDataAgendada(null); setApprovalStep(sp.profissional_id ? "schedule" : "confirm"); }}
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
                      onClick={() => window.open(WHATSAPP, "_blank")}
                    >
                      Suporte
                    </Button>
                 </div>
              </div>
           </div>
        </section>

        {/* Modal Conversar — chat in-app */}
        {showConversar && selectedPedido && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeConversar} />
            <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              {selectedPedido.profissional_id ? (
                <div className="p-4">
                  <Chat
                    orcamentoId={selectedPedido.id}
                    contraparteId={selectedPedido.profissional_id}
                    contraparteNome={selectedPedido.prof}
                  />
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Button variant="outline" onClick={() => window.open(WHATSAPP, "_blank")} className="rounded-full text-xs">
                      <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                    </Button>
                    <Button variant="outline" onClick={() => (window.location.href = "tel:21999999999")} className="rounded-full text-xs">
                      <Phone className="h-3 w-3 mr-1" /> Ligar
                    </Button>
                  </div>
                  <Button variant="ghost" onClick={closeConversar} className="w-full mt-2 text-xs uppercase tracking-widest font-bold">Fechar</Button>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">Aguardando profissional aceitar para iniciar a conversa.</p>
                  <Button variant="ghost" onClick={closeConversar} className="w-full font-bold text-xs uppercase tracking-widest">Fechar</Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Approval Modal */}
        {approvalStep && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => (approvalStep === "confirm" || approvalStep === "schedule") ? setApprovalStep(null) : undefined} />
            <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">

              {/* Step 0: Schedule */}
              {approvalStep === "schedule" && selectedPedido?.profissional_id && (
                <div className="p-8 md:p-10">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold">Escolha o horário</h3>
                    <p className="text-muted-foreground mt-1 text-sm">Selecione data e hora disponíveis na agenda do profissional.</p>
                  </div>
                  <SlotPicker
                    profissionalId={selectedPedido.profissional_id}
                    value={dataAgendada}
                    onChange={setDataAgendada}
                  />
                  <div className="flex gap-3 mt-8">
                    <Button variant="outline" onClick={() => setApprovalStep(null)} className="flex-1 rounded-full h-12 font-bold">Cancelar</Button>
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
                    <p className="text-muted-foreground mt-2 text-sm">Revise o orçamento antes de confirmar</p>
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
                        <span className="font-bold">{dataAgendada.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                    )}
                    <div className="pt-3 border-t border-slate-200 flex justify-between">
                      <span className="font-bold text-brand">Total</span>
                      <span className="font-bold text-brand text-lg">{sp.price}</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center mb-8 leading-relaxed">
                    Ao aprovar, você concorda com os termos do serviço. O profissional será notificado imediatamente.
                  </p>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setApprovalStep(null)} className="flex-1 rounded-full h-13 font-bold">
                      Cancelar
                    </Button>
                    <Button onClick={handleApprove} className="flex-1 bg-brand text-white rounded-full h-13 font-bold shadow-lg hover:scale-[1.02] transition-transform">
                      ✓ Confirmar Aprovação
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Processing */}
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
                  <p className="text-muted-foreground text-sm">Confirmando sua aprovação e notificando o profissional.</p>
                </div>
              )}

              {/* Step 3: Success */}
              {approvalStep === "success" && (
                <div className="p-10 text-center">
                  <div className="h-24 w-24 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-500">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Orçamento Aprovado!</h3>
                  <p className="text-muted-foreground text-sm mb-2">
                    <span className="font-bold text-slate-700">{sp.prof}</span> foi notificado e seu serviço está confirmado.
                  </p>
                  <div className="bg-green-50 rounded-2xl p-4 my-6 text-left space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-800">Status atualizado → <strong>Agendado</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-800">Profissional notificado via WhatsApp</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-800">Confirmação enviada para seu e-mail</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => setApprovalStep(null)}
                    className="w-full bg-[#1a1513] text-white rounded-full h-14 font-bold shadow-lg"
                  >
                    Perfeito, obrigada!
                  </Button>
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
              <span>Status: <span className="text-brand">{activeFilter}</span></span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showFilterDropdown ? "rotate-180" : ""}`} />
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
        {isLoading && (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-border shadow-soft space-y-6">
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
          ))
        )}

        {!isLoading && filteredPedidos.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground font-medium bg-white rounded-[2.5rem] border border-dashed border-border">
             Nenhum pedido encontrado com esses termos.
          </div>
        ) : (
          !isLoading && filteredPedidos.map((p) => (
            <div 
              key={p.id} 
              onClick={() => { openPedido(p.id); }}
              className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-border shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-5">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                  p.status === "Agendado" ? "bg-blue-50 text-blue-600" : 
                  p.status === "Em Análise" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-600"
                }`}>
                  {p.id.slice(0, 4)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg group-hover:text-brand transition-colors">{p.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      p.status === "Agendado" ? "bg-green-100 text-green-700" : 
                      p.status === "Em Análise" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"
                    }`}>
                      {p.uiStatus}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{p.descricao || "Sem descrição."}</p>
                  <div className="flex items-center gap-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between md:flex-col md:items-end gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-0.5">Investimento</p>
                  <p className="text-xl font-bold text-slate-800">{p.displayPrice}</p>
                </div>
                <div className="flex items-center gap-3">
                  {p.status === "enviado" && (
                    <Button 
                      size="sm" 
                      className="bg-brand text-white rounded-full px-6 font-bold shadow-md hover:scale-105 transition-transform"
                      onClick={(e) => { e.stopPropagation(); navigate({ to: "/cliente", search: (prev: any) => ({ ...prev, pedidoId: p.id }) }); }}
                    >
                      Aprovar
                    </Button>
                  )}
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

function ServicosTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [repetindo, setRepetindo] = useState<string | null>(null);

  const { data: servicos = [], isLoading } = useQuery({
    queryKey: ["cliente", "servicos", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("orcamentos")
        .select("id, service_name, service_id, valor, profissional_id, data_pagamento, created_at")
        .eq("cliente_id", user.id)
        .eq("status", "pago")
        .order("data_pagamento", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const repetir = async (s: any) => {
    if (!user) return;
    setRepetindo(s.id);
    const { data, error } = await supabase
      .from("orcamentos")
      .insert({
        cliente_id: user.id,
        service_id: s.service_id,
        service_name: s.service_name,
        descricao: `Repetição do pedido ${s.id.slice(0, 8)}`,
      })
      .select("id")
      .single();
    setRepetindo(null);
    if (error || !data) {
      const { toast } = await import("sonner");
      toast.error("Não foi possível repetir o pedido");
      return;
    }
    navigate({ to: "/cliente", search: (prev: any) => ({ ...prev, tab: "pedidos" as Tab, pedidoId: data.id, id: undefined, details: undefined }) });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-border p-6 md:p-8 space-y-6">
            <div className="flex justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (servicos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-border p-12 text-center">
        <History className="h-10 w-10 text-muted-foreground/50 mx-auto mb-4" />
        <p className="font-bold text-lg">Você ainda não tem serviços concluídos</p>
        <p className="text-sm text-muted-foreground mt-2 mb-6">Quando um serviço for pago e finalizado, ele aparece aqui.</p>
        <Button asChild className="rounded-full bg-brand text-brand-foreground font-bold h-11 px-6">
          <Link to="/servicos">Pedir um orçamento</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {servicos.map((s) => (
        <article key={s.id} className="bg-white rounded-2xl border border-border shadow-soft p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg">{s.service_name}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                #{s.id.slice(0, 8)} • {s.data_pagamento ? new Date(s.data_pagamento).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">R$ {Number(s.valor || 0).toFixed(2)}</span>
              <Button
                onClick={() => repetir(s)}
                disabled={repetindo === s.id}
                size="sm"
                variant="outline"
                className="rounded-full font-bold h-9 px-4"
              >
                {repetindo === s.id ? "..." : "Pedir de novo"}
              </Button>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Como foi este serviço?</p>
            <AvaliacaoForm orcamentoId={s.id} clienteId={user!.id} profissionalId={s.profissional_id} />
          </div>
        </article>
      ))}
    </div>
  );
}

function PagamentosTab() {
  const { user } = useAuth();
  
  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ["cliente", "pagamentos", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("orcamentos")
        .select("id, service_name, valor, status, data_pagamento, created_at")
        .eq("cliente_id", user.id)
        .eq("status", "pago")
        .order("data_pagamento", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  const total = transacoes.reduce((s, t) => s + Number(t.valor || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-foreground text-background p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
          <CreditCard className="absolute -right-6 -bottom-6 h-32 w-32 text-white/5" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60 mb-8">Total já investido</p>
          <div className="space-y-1">
            {isLoading ? (
              <Skeleton className="h-10 w-40 bg-white/10" />
            ) : (
              <p className="text-4xl font-bold tracking-tight">R$ {total.toFixed(2)}</p>
            )}
            <p className="text-sm opacity-60">Em {transacoes.length} {transacoes.length === 1 ? "serviço pago" : "serviços pagos"}</p>
          </div>
          <div className="mt-10 flex justify-between items-end">
            <p className="font-bold opacity-80">Histórico financeiro</p>
            <CheckCircle2 className="h-6 w-6 opacity-60" />
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-border shadow-soft flex flex-col justify-between">
          <h3 className="font-bold text-lg mb-4">Métodos de pagamento</h3>
          <div className="space-y-4 flex-1">
            <div className="p-4 rounded-xl border border-border bg-slate-50">
              <p className="text-sm font-bold mb-1">Pagamento sob demanda</p>
              <p className="text-xs text-muted-foreground">
                A cobrança é gerada automaticamente a cada orçamento aprovado, no método escolhido na tela de checkout (PIX ou cartão).
              </p>
            </div>
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900">
              Cartões salvos para pagamento em 1 clique estarão disponíveis assim que conectarmos um provedor de pagamento (Stripe ou Pagar.me).
            </div>
          </div>
        </div>
      </div>

      <section>
        <h3 className="text-xl font-bold mb-6">Últimas transações</h3>
        <div className="bg-white rounded-2xl border border-border shadow-soft divide-y divide-border">
          {isLoading && (
            <div className="p-6 space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          )}
          {!isLoading && transacoes.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum pagamento registrado ainda. Quando você pagar um orçamento, aparecerá aqui.
            </div>
          )}
          {!isLoading && transacoes.map((t) => {
            const d = t.data_pagamento ? new Date(t.data_pagamento) : new Date(t.created_at);
            return (
              <div key={t.id} className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="text-center w-10 shrink-0">
                    <p className="text-xs font-bold text-brand uppercase">
                      {d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                    </p>
                    <p className="text-lg font-bold leading-none">{d.getDate().toString().padStart(2, "0")}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{t.service_name}</p>
                    <p className="text-xs text-muted-foreground">#{t.id.slice(0, 8)}</p>
                  </div>
                </div>
                <p className="font-bold text-emerald-600 shrink-0">R$ {Number(t.valor || 0).toFixed(2)}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

type Endereco = {
  id: string;
  rotulo: string;
  cep: string | null;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  is_padrao: boolean;
};

const profileSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
});

type ProfileValues = z.infer<typeof profileSchema>;

function DadosTab() {
  const { user, profile, profilePhoto, updatePhoto } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nome: profile?.nome ?? "",
      whatsapp: profile?.whatsapp ?? "",
    }
  });

  useEffect(() => {
    if (profile) {
      reset({
        nome: profile.nome ?? "",
        whatsapp: profile.whatsapp ?? "",
      });
    }
  }, [profile, reset]);

  
  const [editingAddr, setEditingAddr] = useState<Endereco | null>(null);
  const [addrForm, setAddrForm] = useState({ rotulo: "Casa", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" });

  const prefsKey = user ? `mpq_prefs_${user.id}` : null;
  const [whatsappNotifications, setWhatsappNotifications] = useState(true);
  const [promoEmails, setPromoEmails] = useState(false);

  useEffect(() => {
    if (!prefsKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(prefsKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.whatsappNotifications === "boolean") setWhatsappNotifications(p.whatsappNotifications);
        if (typeof p.promoEmails === "boolean") setPromoEmails(p.promoEmails);
      }
    } catch {}
  }, [prefsKey]);

  const savePrefs = (next: { whatsappNotifications?: boolean; promoEmails?: boolean }) => {
    if (!prefsKey || typeof window === "undefined") return;
    const merged = { whatsappNotifications, promoEmails, ...next };
    window.localStorage.setItem(prefsKey, JSON.stringify(merged));
  };

  const handleSaveProfile = async (values: ProfileValues) => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({ nome: values.nome, whatsapp: values.whatsapp }).eq("id", user.id);
    setSavingProfile(false);
    if (error) {
      toastError("Não foi possível salvar", error.message);
      return;
    }
    setIsEditingProfile(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) toastError("Erro", error.message);
    else { setShowSuccess(true); setTimeout(() => setShowSuccess(false), 2500); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => updatePhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const resetAddrForm = () => {
    setAddrForm({ rotulo: "Casa", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" });
    setEditingAddr(null);
  };

  const startEditAddr = (a: Endereco) => {
    setEditingAddr(a);
    setAddrForm({
      rotulo: a.rotulo, cep: a.cep || "", logradouro: a.logradouro, numero: a.numero || "",
      complemento: a.complemento || "", bairro: a.bairro || "", cidade: a.cidade || "", uf: a.uf || "",
    });
    setIsAddingAddress(true);
  };

  const { data: enderecos = [], isLoading: loadingEnderecos, refetch: refetchEnderecos } = useQuery({
    queryKey: ["cliente", "enderecos", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("cliente_enderecos")
        .select("*")
        .eq("user_id", user.id)
        .order("is_padrao", { ascending: false })
        .order("created_at", { ascending: true });
      return (data as any) || [];
    },
    enabled: !!user,
  });

  const handleSaveAddr = async () => {
    if (!user) return;
    if (!addrForm.logradouro.trim()) { toastError("Endereço", "Informe o logradouro"); return; }
    // Geocodifica em paralelo (best-effort, não bloqueia o save em caso de falha)
    const { geocodeAddress } = await import("@/lib/geo");
    const geo = await geocodeAddress({
      logradouro: addrForm.logradouro, numero: addrForm.numero, bairro: addrForm.bairro,
      cidade: addrForm.cidade, uf: addrForm.uf, cep: addrForm.cep,
    });
    const base = {
      rotulo: addrForm.rotulo, cep: addrForm.cep || null, logradouro: addrForm.logradouro,
      numero: addrForm.numero || null, complemento: addrForm.complemento || null,
      bairro: addrForm.bairro || null, cidade: addrForm.cidade || null, uf: addrForm.uf || null,
      lat: geo?.lat ?? null, lng: geo?.lng ?? null,
    };
    if (editingAddr) {
      const { error } = await supabase.from("cliente_enderecos").update(base).eq("id", editingAddr.id);
      if (error) { toastError("Erro", error.message); return; }
    } else {
      const isPadrao = enderecos.length === 0;
      const { error } = await supabase.from("cliente_enderecos").insert({
        ...base, user_id: user.id, is_padrao: isPadrao,
      });
      if (error) { toastError("Erro", error.message); return; }
    }
    setIsAddingAddress(false);
    resetAddrForm();
    refetchEnderecos();
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    await supabase.from("cliente_enderecos").update({ is_padrao: false }).eq("user_id", user.id);
    await supabase.from("cliente_enderecos").update({ is_padrao: true }).eq("id", id);
    refetchEnderecos();
  };

  const handleRemoveAddr = async (id: string) => {
    if (!confirm("Remover este endereço?")) return;
    await supabase.from("cliente_enderecos").delete().eq("id", id);
    refetchEnderecos();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_2fr] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sidebar */}
      <div className="space-y-6">
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft text-center">
          <div className="relative mx-auto w-24 h-24 mb-6 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={handleFileChange} />
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-full h-full rounded-full object-cover border-2 border-brand/20" />
            ) : (
              <div className="w-full h-full rounded-full bg-brand/10 border-2 border-brand/20 flex items-center justify-center text-brand text-3xl font-bold">
                {(profile?.nome?.[0] || profile?.email?.[0] || "?").toUpperCase()}
              </div>
            )}
            <div className="absolute bottom-0 right-0 p-2 rounded-full bg-[#2a1f1d] text-white shadow-lg border-2 border-white transition group-hover:scale-110">
              <Camera className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-xl font-bold">{profile?.nome || "Cliente"}</h3>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
          <div className="mt-8 pt-8 border-t border-border flex justify-around">
            <div>
              <p className="text-xl font-bold">{profile && (profile as any).total_servicos_pagos != null ? (profile as any).total_servicos_pagos : "—"}</p>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Serviços pagos</p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
          <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand" /> Segurança
          </h4>
          <div className="space-y-3">
            <Button variant="outline" className="w-full rounded-xl justify-between text-xs font-bold py-6 group" onClick={handleResetPassword}>
              Enviar link p/ redefinir senha
              <ChevronRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
            </Button>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Você receberá um e-mail em {user?.email} com um link seguro para criar uma nova senha.
            </p>
          </div>
        </section>
      </div>

      {/* Forms */}
      <div className="space-y-8">
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-brand" />
              <h3 className="font-bold text-lg">Dados cadastrais</h3>
            </div>
            {!isEditingProfile ? (
              <Button size="sm" variant="ghost" className="text-brand font-bold" onClick={() => setIsEditingProfile(true)}>Editar</Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => {
                  reset();
                  setIsEditingProfile(false);
                }}>Cancelar</Button>
                <Button size="sm" disabled={savingProfile} className="bg-brand text-white rounded-full px-6 font-bold" onClick={handleSubmit(handleSaveProfile)}>
                  {savingProfile ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            )}
          </div>

          {!isEditingProfile ? (
            <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2 animate-in fade-in duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome completo</label>
                <p className="text-lg font-medium text-slate-800">{profile?.nome || "—"}</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp</label>
                <p className="text-lg font-medium text-slate-800">{profile?.whatsapp || "—"}</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">E-mail</label>
                <p className="text-lg font-medium text-slate-800">{profile?.email || user?.email}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(handleSaveProfile)} className="grid gap-x-8 gap-y-6 sm:grid-cols-2 animate-in fade-in duration-300">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome completo</label>
                <input
                  {...register("nome")}
                  className={`w-full text-sm font-medium pb-2 border-b focus:outline-none transition-colors bg-transparent ${errors.nome ? "border-red-500" : "border-brand focus:border-brand"}`}
                />
                {errors.nome && <p className="text-[10px] text-red-500 font-bold">{errors.nome.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp</label>
                <input
                  {...register("whatsapp")}
                  placeholder="+55 (21) 99999-9999"
                  className={`w-full text-sm font-medium pb-2 border-b focus:outline-none transition-colors bg-transparent ${errors.whatsapp ? "border-red-500" : "border-brand focus:border-brand"}`}
                />
                {errors.whatsapp && <p className="text-[10px] text-red-500 font-bold">{errors.whatsapp.message}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">E-mail</label>
                <input
                  type="email" value={user?.email || ""} disabled
                  className="w-full text-sm font-medium pb-2 border-b border-border bg-transparent text-muted-foreground"
                />
                <p className="text-[10px] text-muted-foreground">O e-mail é o seu identificador de login e não pode ser editado por aqui.</p>
              </div>
            </form>
          )}
        </section>

        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-brand" />
              <h3 className="font-bold text-lg">Endereços de atendimento</h3>
            </div>
            {!isAddingAddress && (
              <Button
                onClick={() => { resetAddrForm(); setIsAddingAddress(true); }}
                size="sm"
                className="rounded-full bg-brand text-white hover:bg-brand/90 font-bold px-6 h-10 shadow-md"
              >
                + Novo
              </Button>
            )}
          </div>

          {isAddingAddress && (
            <div className="mb-8 p-6 rounded-2xl border border-brand/30 bg-brand/5 animate-in fade-in duration-300">
              <h4 className="font-bold mb-4 text-brand">{editingAddr ? "Editar endereço" : "Adicionar novo endereço"}</h4>
              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                <Field label="Rótulo (Ex: Casa)">
                  <input value={addrForm.rotulo} onChange={(e) => setAddrForm({ ...addrForm, rotulo: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border bg-white text-sm" placeholder="Casa" />
                </Field>
                <Field label="CEP">
                  <input value={addrForm.cep} onChange={(e) => setAddrForm({ ...addrForm, cep: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border bg-white text-sm" placeholder="00000-000" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Logradouro">
                    <input value={addrForm.logradouro} onChange={(e) => setAddrForm({ ...addrForm, logradouro: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-border bg-white text-sm" placeholder="Rua, Avenida…" />
                  </Field>
                </div>
                <Field label="Número">
                  <input value={addrForm.numero} onChange={(e) => setAddrForm({ ...addrForm, numero: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border bg-white text-sm" placeholder="123" />
                </Field>
                <Field label="Complemento">
                  <input value={addrForm.complemento} onChange={(e) => setAddrForm({ ...addrForm, complemento: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border bg-white text-sm" placeholder="Apto 101" />
                </Field>
                <Field label="Bairro">
                  <input value={addrForm.bairro} onChange={(e) => setAddrForm({ ...addrForm, bairro: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-border bg-white text-sm" />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Field label="Cidade">
                      <input value={addrForm.cidade} onChange={(e) => setAddrForm({ ...addrForm, cidade: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-border bg-white text-sm" />
                    </Field>
                  </div>
                  <Field label="UF">
                    <input value={addrForm.uf} maxLength={2} onChange={(e) => setAddrForm({ ...addrForm, uf: e.target.value.toUpperCase() })}
                      className="w-full p-2.5 rounded-xl border border-border bg-white text-sm uppercase" placeholder="RJ" />
                  </Field>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={() => { setIsAddingAddress(false); resetAddrForm(); }}>Cancelar</Button>
                <Button className="bg-brand text-white rounded-full font-bold px-8" onClick={handleSaveAddr}>Salvar endereço</Button>
              </div>
            </div>
          )}

          {loadingEnderecos && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="p-6 rounded-[1.5rem] border border-border bg-slate-50 space-y-4">
                  <div className="flex justify-between">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <div className="pt-4 flex gap-4">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loadingEnderecos && enderecos.length === 0 && !isAddingAddress ? (
            <p className="text-sm text-muted-foreground text-center py-6">Você ainda não cadastrou endereços.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {!loadingEnderecos && enderecos.map((addr: Endereco) => (
                <div key={addr.id} className={`p-6 rounded-[1.5rem] border transition-all ${addr.is_padrao ? "border-brand/20 bg-brand-soft/30 ring-1 ring-brand/10" : "border-border bg-slate-50 hover:bg-white hover:shadow-md"}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${addr.is_padrao ? "bg-brand text-white" : "bg-white text-muted-foreground"}`}>
                      <MapPin className="h-4 w-4" />
                    </div>
                    {addr.is_padrao && <span className="text-[10px] font-bold uppercase text-brand">Padrão</span>}
                  </div>
                  <p className="font-bold text-sm mb-1">{addr.rotulo}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {addr.logradouro}{addr.numero ? `, ${addr.numero}` : ""}{addr.complemento ? ` · ${addr.complemento}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {[addr.bairro, addr.cidade, addr.uf].filter(Boolean).join(", ")}
                  </p>
                  {addr.cep && <p className="text-[10px] font-mono text-muted-foreground mt-2">{addr.cep}</p>}
                  <div className="mt-4 pt-4 border-t border-border/40 flex gap-4">
                    <button className="text-[10px] font-bold uppercase text-brand hover:underline" onClick={() => startEditAddr(addr)}>Editar</button>
                    {!addr.is_padrao && <button className="text-[10px] font-bold uppercase text-muted-foreground hover:text-brand hover:underline" onClick={() => handleSetDefault(addr.id)}>Tornar padrão</button>}
                    {!addr.is_padrao && <button className="text-[10px] font-bold uppercase text-red-500 hover:underline ml-auto" onClick={() => handleRemoveAddr(addr.id)}>Remover</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-2xl bg-brand/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-brand" />
            </div>
            <h3 className="font-bold text-lg">Preferências de contato</h3>
          </div>
          <div className="space-y-4">
            <Toggle
              label="Notificações via WhatsApp"
              desc="Avisos de agendamento e chegada do profissional."
              value={whatsappNotifications}
              onChange={(v) => { setWhatsappNotifications(v); savePrefs({ whatsappNotifications: v }); }}
            />
            <Toggle
              label="E-mails de promoção"
              desc="Receba cupons de desconto e dicas de manutenção."
              value={promoEmails}
              onChange={(v) => { setPromoEmails(v); savePrefs({ promoEmails: v }); }}
            />
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">As preferências ficam salvas neste navegador.</p>
        </section>
      </div>

      {showSuccess && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="bg-[#1a1513] text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 border border-white/10">
            <div className="h-6 w-6 bg-green-500 text-white rounded-full flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <p className="font-bold text-sm tracking-wide">Alterações salvas com sucesso!</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-muted-foreground uppercase">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      className="flex items-center justify-between p-6 rounded-[1.5rem] bg-slate-50/50 border border-slate-100 hover:border-brand/10 transition-colors cursor-pointer group"
      onClick={() => onChange(!value)}
    >
      <div>
        <p className="text-sm font-bold group-hover:text-brand transition-colors">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${value ? "bg-[#b85c45]" : "bg-slate-200"}`}>
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${value ? "translate-x-5" : "translate-x-0"}`} />
      </div>
    </div>
  );
}

function toastError(title: string, description?: string) {
  // lazy import to avoid circular issues
  import("sonner").then((m) => m.toast.error(title, description ? { description } : undefined));
}
