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
  X
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/cliente")({
  component: ClienteArea,
});

type Tab = "inicio" | "pedidos" | "servicos" | "pagamentos" | "dados" | "notificacoes";

function ClienteArea() {
  const [activeTab, setActiveTab] = useState<Tab>("inicio");
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  useEffect(() => {
     if (window.location.search.includes("tab=notificacoes")) {
        setActiveTab("notificacoes");
     }
  }, []);

  const sidebarItems = [
    { id: "inicio", label: "Meu Painel", icon: LayoutDashboard },
    { id: "pedidos", label: "Pedidos e Orçamentos", icon: ClipboardList },
    { id: "servicos", label: "Histórico de Serviços", icon: History },
    { id: "pagamentos", label: "Pagamentos", icon: CreditCard },
    { id: "notificacoes", label: "Notificações", icon: Bell },
    { id: "dados", label: "Meus Dados", icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-border shrink-0 z-20">
        <div className="p-8 hidden md:block">
           <span className="text-xs font-bold uppercase tracking-widest text-brand">Área do Cliente</span>
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
              {sidebarItems.find(i => i.id === activeTab)?.label}
            </h1>
            <p className="text-muted-foreground mt-1">Bem-vinda de volta, Carolina!</p>
          </div>
        </header>

        {activeTab === "inicio" && <DashboardTab setActiveTab={setActiveTab} />}
        {activeTab === "pedidos" && <PedidosTab />}
        {activeTab === "servicos" && <ServicosTab />}
        {activeTab === "pagamentos" && <PagamentosTab />}
        {activeTab === "notificacoes" && <NotificacoesTab />}
        {activeTab === "dados" && <DadosTab />}
      </main>
    </div>
  );
}

function NotificacoesTab() {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedNotification = notifications.find(n => n.id === selectedId);

  const handleNotificationClick = (id: number) => {
    markAsRead(id);
    setSelectedId(id);
  };

  if (selectedNotification) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <button 
          onClick={() => setSelectedId(null)}
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
                  <p className="text-sm font-bold text-brand">Ver detalhes completos</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row gap-4">
            <Button className="bg-[#1a1513] text-white rounded-full px-8 font-bold h-12 shadow-lg hover:scale-[1.02] transition-transform">Ir para o Serviço</Button>
            <Button variant="outline" className="rounded-full px-8 font-bold h-12 border-border" onClick={() => setSelectedId(null)}>Marcar como resolvido</Button>
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
               onClick={() => handleNotificationClick(n.id)}
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Serviços Realizados", value: "12", icon: CheckCircle2, color: "text-green-600", tab: "servicos" as const },
          { label: "Pedidos Ativos", value: "2", icon: Clock, color: "text-[#b85c45]", tab: "pedidos" as const },
          { label: "Orçamentos Pendentes", value: "1", icon: AlertCircle, color: "text-amber-500", tab: "pedidos" as const },
          { label: "Total Investido", value: "R$ 2.450", icon: CreditCard, color: "text-slate-600", tab: "pagamentos" as const },
        ].map((stat) => (
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
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* Recent Activity */}
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold">Atividade Recente</h2>
            <button className="text-sm font-semibold text-brand hover:underline" onClick={() => setActiveTab("servicos")}>Ver tudo</button>
          </div>
          <div className="space-y-6">
            {[
              { title: "Instalação de Chuveiro", status: "Concluído", date: "Ontem, 14:30", type: "servico" },
              { title: "Orçamento: Pintura Sala", status: "Aguardando aprovação", date: "Há 2 dias", type: "orcamento" },
              { title: "Montagem de Guarda-roupa", status: "Agendado para 10/05", date: "Há 3 dias", type: "pedido" },
            ].map((item, i) => (
              <div 
                key={i} 
                className="flex items-center gap-4 group cursor-pointer" 
                onClick={() => setActiveTab(item.type === "servico" ? "servicos" : "pedidos")}
              >
                <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                  item.type === "servico" ? "bg-green-50 text-green-600" : 
                  item.type === "orcamento" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                }`}>
                  {item.type === "servico" ? <CheckCircle2 className="h-5 w-5" /> : 
                   item.type === "orcamento" ? <FileText className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold group-hover:text-brand transition-colors">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.status} • {item.date}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            ))}
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
                <p className="text-sm text-white/70 mb-6">Solicite um novo orçamento agora pelo WhatsApp.</p>
                <Button className="w-full rounded-full bg-brand text-brand-foreground hover:bg-brand/90 font-bold">
                   Solicitar Agora
                </Button>
             </div>
           )}
           
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

function PedidosTab() {
  const [view, setView] = useState<"list" | "detail" | "new">("list");
  const [selectedPedido, setSelectedPedido] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const pedidos = [
    { 
      id: "#8842", 
      title: "Montagem de Painel de TV", 
      status: "Agendado", 
      date: "10/05/2026", 
      price: "R$ 150", 
      prof: "Mariana S.",
      description: "Montagem de painel articulado em parede de drywall." 
    },
    { 
      id: "#8839", 
      title: "Reparo Hidráulico Cozinha", 
      status: "Em Análise", 
      date: "Solicitado hoje", 
      price: "A definir", 
      prof: "-",
      description: "Vazamento no sifão da pia da cozinha." 
    },
    { 
      id: "#8830", 
      title: "Pintura de Quarto", 
      status: "Aguardando Aprovação", 
      date: "Há 2 dias", 
      price: "R$ 450", 
      prof: "Ricardo M.",
      description: "Pintura completa de quarto de 12m² com massa corrida." 
    },
  ];

  const filteredPedidos = pedidos.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (view === "new") {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <button 
          onClick={() => setView("list")}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-brand transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar para pedidos
        </button>

        <section className="bg-white rounded-[2.5rem] border border-border p-8 md:p-12 shadow-soft">
           <div className="max-w-2xl">
              <h2 className="text-3xl font-bold mb-2">Novo Pedido</h2>
              <p className="text-muted-foreground mb-10">Conte-nos o que você precisa e enviaremos um profissional qualificado.</p>

              <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); setView("list"); }}>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">O que você precisa?</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Instalação de chuveiro, pintura de porta..." 
                      className="w-full text-lg font-medium pb-4 border-b border-border focus:outline-none focus:border-brand transition-colors bg-transparent" 
                    />
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Descrição Detalhada</label>
                    <textarea 
                      placeholder="Descreva o serviço com o máximo de detalhes possível..." 
                      rows={3}
                      className="w-full text-base font-medium pb-4 border-b border-border focus:outline-none focus:border-brand transition-colors bg-transparent resize-none" 
                    />
                 </div>

                 <div className="grid gap-8 sm:grid-cols-2">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Urgência</label>
                       <select className="w-full text-sm font-medium pb-2 border-b border-border focus:outline-none focus:border-brand transition-colors bg-transparent appearance-none">
                          <option>Padrão (até 48h)</option>
                          <option>Urgente (hoje)</option>
                          <option>Agendado (escolher data)</option>
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Fotos do Local</label>
                       <div className="flex gap-2">
                          <button type="button" className="h-12 w-12 rounded-xl bg-slate-50 border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-brand hover:text-brand transition-all">
                             <Plus className="h-5 w-5" />
                          </button>
                          <p className="text-xs text-muted-foreground flex items-center">Opcional, ajuda no orçamento.</p>
                       </div>
                    </div>
                 </div>

                 <div className="pt-8 flex gap-4">
                    <Button type="submit" className="bg-brand text-white rounded-full px-12 font-bold h-14 shadow-xl hover:scale-[1.02] transition-transform">Solicitar Orçamento</Button>
                    <Button type="button" variant="ghost" onClick={() => setView("list")} className="h-14 font-bold">Cancelar</Button>
                 </div>
              </form>
           </div>
        </section>
      </div>
    );
  }

  if (view === "detail" && selectedPedido) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <button 
          onClick={() => setView("list")}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-brand transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar para pedidos
        </button>

        <section className="bg-white rounded-[2.5rem] border border-border p-8 md:p-12 shadow-soft">
           <div className="flex flex-col md:flex-row justify-between gap-8 mb-12">
              <div className="flex items-start gap-6">
                 <div className={`h-20 w-20 rounded-3xl flex items-center justify-center font-bold text-xl shrink-0 ${
                    selectedPedido.status === "Agendado" ? "bg-blue-50 text-blue-600" : 
                    selectedPedido.status === "Em Análise" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-600"
                 }`}>
                    {selectedPedido.id}
                 </div>
                 <div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block mb-3 ${
                      selectedPedido.status === "Agendado" ? "bg-green-100 text-green-700" : 
                      selectedPedido.status === "Em Análise" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"
                    }`}>
                      {selectedPedido.status}
                    </span>
                    <h2 className="text-3xl font-bold">{selectedPedido.title}</h2>
                    <p className="text-muted-foreground mt-2">{selectedPedido.description}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Investimento</p>
                 <p className="text-3xl font-bold text-slate-800">{selectedPedido.price}</p>
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
                          <p className="text-xs text-muted-foreground">{selectedPedido.date}</p>
                       </div>
                       {selectedPedido.status !== "Em Análise" && (
                          <div className="relative pl-6">
                             <div className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full bg-brand border-4 border-white shadow-sm" />
                             <p className="text-sm font-bold">Orçamento enviado</p>
                             <p className="text-xs text-muted-foreground">Há 1 dia</p>
                          </div>
                       )}
                       {selectedPedido.status === "Agendado" && (
                          <div className="relative pl-6">
                             <div className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full bg-green-500 border-4 border-white shadow-sm" />
                             <p className="text-sm font-bold">Serviço agendado</p>
                             <p className="text-xs text-muted-foreground">{selectedPedido.date}</p>
                          </div>
                       )}
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 {selectedPedido.prof !== "-" && (
                    <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                       <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Profissional Responsável</h4>
                       <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-slate-200" />
                          <div>
                             <p className="font-bold">{selectedPedido.prof}</p>
                             <p className="text-xs text-muted-foreground">Especialista em Manutenção</p>
                          </div>
                          <Button size="sm" variant="outline" className="ml-auto rounded-full text-xs font-bold">Conversar</Button>
                       </div>
                    </div>
                 )}
                 <div className="flex gap-4">
                    {selectedPedido.status === "Aguardando Aprovação" && (
                       <Button className="flex-1 bg-brand text-white rounded-full font-bold h-12 shadow-lg">Aprovar Orçamento</Button>
                    )}
                    <Button variant="outline" className="flex-1 rounded-full font-bold h-12">Suporte</Button>
                 </div>
              </div>
           </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por ID ou serviço..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-full border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full px-6 shadow-sm">Filtrar</Button>
          <Button 
            onClick={() => setView("new")}
            className="rounded-full px-6 bg-[#b85c45] hover:bg-[#b85c45]/90 text-white shadow-sm font-medium"
          >
            Novo Pedido
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {filteredPedidos.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground font-medium bg-white rounded-[2.5rem] border border-dashed border-border">
             Nenhum pedido encontrado com esses termos.
          </div>
        ) : (
          filteredPedidos.map((p) => (
            <div 
              key={p.id} 
              onClick={() => { setSelectedPedido(p); setView("detail"); }}
              className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-border shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-5">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                  p.status === "Agendado" ? "bg-blue-50 text-blue-600" : 
                  p.status === "Em Análise" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-600"
                }`}>
                  {p.id}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg group-hover:text-brand transition-colors">{p.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      p.status === "Agendado" ? "bg-green-100 text-green-700" : 
                      p.status === "Em Análise" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{p.description}</p>
                  <div className="flex items-center gap-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {p.date}</span>
                    {p.prof !== "-" && <span className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> {p.prof}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between md:flex-col md:items-end gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-0.5">Investimento</p>
                  <p className="text-xl font-bold text-slate-800">{p.price}</p>
                </div>
                <div className="flex items-center gap-3">
                  {p.status === "Aguardando Aprovação" && (
                    <Button 
                      size="sm" 
                      className="bg-brand text-white rounded-full px-6 font-bold shadow-md hover:scale-105 transition-transform"
                      onClick={(e) => { e.stopPropagation(); alert("Orçamento Aprovado!"); }}
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
  const servicos = [
    { id: "#8750", title: "Troca de Resistência Chuveiro", date: "02/05/2026", price: "R$ 80", prof: "Mariana S.", rating: 5 },
    { id: "#8621", title: "Instalação de Lustre", date: "20/04/2026", price: "R$ 120", prof: "Ricardo M.", rating: 5 },
    { id: "#8500", title: "Furos e Quadros", date: "15/04/2026", price: "R$ 90", prof: "Juliana P.", rating: 4 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-soft">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground font-bold">
              <tr>
                <th className="px-6 py-4">Serviço</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Profissional</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {servicos.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="font-bold">{s.title}</div>
                    <div className="text-xs text-muted-foreground">{s.id}</div>
                  </td>
                  <td className="px-6 py-5 text-sm text-muted-foreground">{s.date}</td>
                  <td className="px-6 py-5 text-sm font-medium">{s.prof}</td>
                  <td className="px-6 py-5 text-sm font-bold">{s.price}</td>
                  <td className="px-6 py-5">
                    <button className="text-xs font-bold text-brand hover:underline">Revisar nota fiscal</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
       </div>
    </div>
  );
}

function PagamentosTab() {
  const [isAddingCard, setIsAddingCard] = useState(false);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Cards */}
        <div className="bg-foreground text-background p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
          <CreditCard className="absolute -right-6 -bottom-6 h-32 w-32 text-white/5" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60 mb-8">Cartão Principal</p>
          <div className="space-y-1">
             <p className="text-xl font-mono tracking-widest">•••• •••• •••• 4492</p>
             <p className="text-sm opacity-60">Expira em 12/28</p>
          </div>
          <div className="mt-10 flex justify-between items-end">
            <p className="font-bold">Carolina L. Silva</p>
            <div className="h-8 w-12 bg-white/20 rounded-md" />
          </div>
        </div>

        {/* Payment History Summary */}
        <div className="bg-white p-8 rounded-[2rem] border border-border shadow-soft flex flex-col justify-between">
          <h3 className="font-bold text-lg mb-4">Meios de Pagamento</h3>
          <div className="space-y-4">
             <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-slate-50">
                <div className="flex items-center gap-3">
                   <CreditCard className="h-5 w-5 text-brand" />
                   <span className="text-sm font-medium">Visa •••• 4492</span>
                </div>
                <span className="text-[10px] font-bold uppercase text-brand">Padrão</span>
             </div>
             {!isAddingCard ? (
                 <div className="flex items-center justify-between p-4 rounded-xl border border-border border-dashed hover:border-brand transition-colors cursor-pointer" onClick={() => setIsAddingCard(true)}>
                    <div className="flex items-center gap-3">
                       <Plus className="h-5 w-5 text-muted-foreground" />
                       <span className="text-sm font-medium text-muted-foreground">Adicionar novo método</span>
                    </div>
                 </div>
             ) : (
                 <div className="p-4 rounded-xl border border-brand/20 bg-brand/5 animate-in fade-in duration-300">
                    <h4 className="font-bold text-sm mb-3 text-brand">Novo Cartão de Crédito</h4>
                    <div className="space-y-3">
                       <input type="text" placeholder="Número do Cartão" className="w-full p-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                       <div className="flex gap-3">
                          <input type="text" placeholder="MM/AA" className="w-1/2 p-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                          <input type="text" placeholder="CVC" className="w-1/2 p-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                       </div>
                       <input type="text" placeholder="Nome como no cartão" className="w-full p-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                       <div className="flex gap-2 justify-end pt-2">
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => setIsAddingCard(false)}>Cancelar</Button>
                          <Button size="sm" className="bg-brand text-white rounded-full h-8 px-4 font-bold" onClick={() => setIsAddingCard(false)}>Salvar Cartão</Button>
                       </div>
                    </div>
                 </div>
             )}
          </div>
        </div>
      </div>

      <section>
         <h3 className="text-xl font-bold mb-6">Últimas Transações</h3>
         <div className="bg-white rounded-2xl border border-border shadow-soft divide-y divide-border">
            {[
              { date: "02 Mai", desc: "Sinal: Troca de Resistência", value: "- R$ 40,00", method: "Visa •••• 4492" },
              { date: "20 Abr", desc: "Instalação de Lustre", value: "- R$ 120,00", method: "Pix" },
              { date: "15 Abr", desc: "Furos e Quadros", value: "- R$ 90,00", method: "Pix" },
            ].map((t, i) => (
              <div key={i} className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                   <div className="text-center w-10">
                      <p className="text-xs font-bold text-brand uppercase">{t.date.split(" ")[1]}</p>
                      <p className="text-lg font-bold leading-none">{t.date.split(" ")[0]}</p>
                   </div>
                   <div>
                      <p className="font-bold">{t.desc}</p>
                      <p className="text-xs text-muted-foreground">{t.method}</p>
                   </div>
                </div>
                <p className="font-bold text-red-600">{t.value}</p>
              </div>
            ))}
         </div>
      </section>
    </div>
  );
}

function DadosTab() {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [whatsappNotifications, setWhatsappNotifications] = useState(true);
  const [promoEmails, setPromoEmails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { profilePhoto, updatePhoto, userData, updateUserData } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState(userData);

  // Sincronizar formData se userData mudar (ex: login)
  useEffect(() => {
    setFormData(userData);
  }, [userData]);

  const handleSaveProfile = () => {
    updateUserData(formData);
    setIsEditingProfile(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleSaveAll = () => {
    setIsSaving(true);
    updateUserData(formData); // Garante que tudo seja salvo
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updatePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_2fr] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Profile Sidebar */}
      <div className="space-y-6">
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft text-center">
          <div className="relative mx-auto w-24 h-24 mb-6 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={handleFileChange} />
            {profilePhoto ? (
               <img src={profilePhoto} alt="Profile" className="w-full h-full rounded-full object-cover border-2 border-brand/20" />
            ) : (
               <div className="w-full h-full rounded-full bg-brand/10 border-2 border-brand/20 flex items-center justify-center text-brand text-3xl font-bold">
                 C
               </div>
            )}
            <div className="absolute bottom-0 right-0 p-2 rounded-full bg-[#2a1f1d] text-white shadow-lg border-2 border-white transition group-hover:scale-110">
              <Camera className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-xl font-bold">{userData.name}</h3>
          <p className="text-sm text-muted-foreground">Cliente Nível Gold</p>
          
          <div className="mt-8 pt-8 border-t border-border flex justify-around">
             <div>
                <p className="text-xl font-bold">12</p>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Serviços</p>
             </div>
             <div className="w-px h-10 bg-border" />
             <div>
                <p className="text-xl font-bold">4.9</p>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Nota</p>
             </div>
          </div>
        </section>

        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
           <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand" /> Segurança
           </h4>
           <div className="space-y-3">
              {!isEditingPassword ? (
                 <Button variant="outline" className="w-full rounded-xl justify-between text-xs font-bold py-6 group" onClick={() => setIsEditingPassword(true)}>
                   Alterar Senha
                   <ChevronRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                 </Button>
              ) : (
                 <div className="p-4 border border-brand/20 bg-brand/5 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-xs font-bold text-brand">Criar nova senha</p>
                    <input type="password" placeholder="Senha Atual" className="w-full p-2.5 rounded-lg border border-border bg-white text-xs focus:outline-none focus:ring-1 focus:ring-brand" />
                    <input type="password" placeholder="Nova Senha" className="w-full p-2.5 rounded-lg border border-border bg-white text-xs focus:outline-none focus:ring-1 focus:ring-brand" />
                    <div className="flex gap-2 justify-end pt-1">
                       <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setIsEditingPassword(false)}>Cancelar</Button>
                       <Button size="sm" className="h-8 text-xs bg-brand text-white rounded-full px-4 font-bold" onClick={() => setIsEditingPassword(false)}>Atualizar</Button>
                    </div>
                 </div>
              )}

              <Button 
                variant="outline" 
                className={`w-full rounded-xl justify-between text-xs font-bold py-6 group transition-all ${is2FAEnabled ? "border-brand/30 bg-brand/5" : ""}`}
                onClick={() => setIs2FAEnabled(!is2FAEnabled)}
              >
                Autenticação em 2 Fatores
                <span className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${is2FAEnabled ? "bg-brand text-white" : "bg-amber-100 text-amber-700"}`}>
                  {is2FAEnabled ? "Ativado" : "Desativado"}
                </span>
              </Button>
           </div>
        </section>
      </div>

      {/* Profile Forms */}
      <div className="space-y-8">
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                 <User className="h-5 w-5 text-brand" />
                 <h3 className="font-bold text-lg">Dados Cadastrais</h3>
              </div>
              {!isEditingProfile ? (
                 <Button size="sm" variant="ghost" className="text-brand font-bold" onClick={() => setIsEditingProfile(true)}>Editar</Button>
              ) : (
                 <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setFormData(userData); // Reset form
                      setIsEditingProfile(false);
                    }}>Cancelar</Button>
                    <Button size="sm" className="bg-brand text-white rounded-full px-6 font-bold" onClick={handleSaveProfile}>Salvar</Button>
                 </div>
              )}
           </div>
           
           {!isEditingProfile ? (
              <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2 animate-in fade-in duration-300">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome Completo</label>
                   <p className="text-lg font-medium text-slate-800">{userData.name}</p>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp</label>
                   <p className="text-lg font-medium text-slate-800">{userData.whatsapp}</p>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data de Nascimento</label>
                   <p className="text-lg font-medium text-slate-800">{userData.birthDate}</p>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">E-mail</label>
                   <p className="text-lg font-medium text-slate-800">{userData.email}</p>
                 </div>
              </div>
           ) : (
              <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 animate-in fade-in duration-300">
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome Completo</label>
                   <input 
                     type="text" 
                     value={formData.name} 
                     onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                     className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none focus:border-brand transition-colors bg-transparent" 
                   />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp</label>
                   <input 
                     type="text" 
                     value={formData.whatsapp} 
                     onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                     className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none focus:border-brand transition-colors bg-transparent" 
                   />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">E-mail Principal</label>
                   <input 
                     type="email" 
                     value={formData.email} 
                     onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                     className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none focus:border-brand transition-colors bg-transparent" 
                   />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data de Nascimento</label>
                   <input 
                     type="text" 
                     value={formData.birthDate} 
                     onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                     className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none focus:border-brand transition-colors bg-transparent" 
                   />
                 </div>
              </div>
           )}
        </section>

        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                 <MapPin className="h-5 w-5 text-brand" />
                 <h3 className="font-bold text-lg">Endereços de Atendimento</h3>
              </div>
              {!isAddingAddress && (
                 <Button size="sm" className="rounded-full bg-brand/10 text-brand hover:bg-brand hover:text-white font-bold transition-colors" onClick={() => setIsAddingAddress(true)}>
                    + Novo
                 </Button>
              )}
           </div>

           {isAddingAddress && (
              <div className="mb-8 p-6 rounded-2xl border border-brand/30 bg-brand/5 animate-in fade-in duration-300">
                 <h4 className="font-bold mb-4 text-brand">Adicionar Novo Endereço</h4>
                 <div className="grid gap-4 sm:grid-cols-2 mb-6">
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-muted-foreground uppercase">Nome do Local (Ex: Casa)</label>
                       <input type="text" className="w-full p-2.5 rounded-xl border border-border bg-white text-sm" placeholder="Meu Apartamento" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-muted-foreground uppercase">CEP</label>
                       <input type="text" className="w-full p-2.5 rounded-xl border border-border bg-white text-sm" placeholder="00000-000" />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                       <label className="text-[10px] font-bold text-muted-foreground uppercase">Endereço Completo</label>
                       <input type="text" className="w-full p-2.5 rounded-xl border border-border bg-white text-sm" placeholder="Rua, Avenida, etc." />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-muted-foreground uppercase">Número</label>
                       <input type="text" className="w-full p-2.5 rounded-xl border border-border bg-white text-sm" placeholder="123" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-muted-foreground uppercase">Complemento / Bairro</label>
                       <input type="text" className="w-full p-2.5 rounded-xl border border-border bg-white text-sm" placeholder="Apto 101, Centro" />
                    </div>
                 </div>
                 <div className="flex gap-3 justify-end">
                    <Button variant="ghost" onClick={() => setIsAddingAddress(false)}>Cancelar</Button>
                    <Button className="bg-brand text-white rounded-full font-bold px-8" onClick={() => setIsAddingAddress(false)}>Salvar Endereço</Button>
                 </div>
              </div>
           )}

           <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Casa", address: "Rua das Flores, 120, Apto 402", neighbor: "Ipanema, RJ", cep: "22410-003", default: true },
                { label: "Trabalho", address: "Av. Rio Branco, 500, Sala 12", neighbor: "Centro, RJ", cep: "20040-003", default: false },
              ].map((addr) => (
                <div key={addr.label} className={`p-6 rounded-[1.5rem] border transition-all ${addr.default ? "border-brand/20 bg-brand-soft/30 ring-1 ring-brand/10" : "border-border bg-slate-50 hover:bg-white hover:shadow-md"}`}>
                   <div className="flex justify-between items-start mb-4">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${addr.default ? "bg-brand text-white" : "bg-white text-muted-foreground"}`}>
                         <MapPin className="h-4 w-4" />
                      </div>
                      {addr.default && <span className="text-[10px] font-bold uppercase text-brand">Padrão</span>}
                   </div>
                   <p className="font-bold text-sm mb-1">{addr.label}</p>
                   <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1">{addr.address}</p>
                   <p className="text-xs text-muted-foreground leading-relaxed">{addr.neighbor}</p>
                   <p className="text-[10px] font-mono text-muted-foreground mt-2">{addr.cep}</p>
                   
                   <div className="mt-4 pt-4 border-t border-border/40 flex gap-4">
                      <button className="text-[10px] font-bold uppercase text-brand hover:underline">Editar</button>
                      {!addr.default && <button className="text-[10px] font-bold uppercase text-muted-foreground hover:text-brand hover:underline">Tornar Padrão</button>}
                      {!addr.default && <button className="text-[10px] font-bold uppercase text-red-500 hover:underline ml-auto">Remover</button>}
                   </div>
                </div>
              ))}
           </div>
        </section>

        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft relative overflow-hidden">
           <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 rounded-2xl bg-brand/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-brand" />
              </div>
              <h3 className="font-bold text-lg">Preferências de Contato</h3>
           </div>
           
           <div className="space-y-4">
              <div 
                className="flex items-center justify-between p-6 rounded-[1.5rem] bg-slate-50/50 border border-slate-100 hover:border-brand/10 transition-colors cursor-pointer group"
                onClick={() => setWhatsappNotifications(!whatsappNotifications)}
              >
                 <div>
                    <p className="text-sm font-bold group-hover:text-brand transition-colors">Notificações via WhatsApp</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Avisos de agendamento e chegada do profissional.</p>
                 </div>
                 <div 
                   className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${whatsappNotifications ? 'bg-[#b85c45]' : 'bg-slate-200'}`}
                 >
                   <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${whatsappNotifications ? 'translate-x-5' : 'translate-x-0'}`} />
                 </div>
              </div>

              <div 
                className="flex items-center justify-between p-6 rounded-[1.5rem] bg-slate-50/50 border border-slate-100 hover:border-brand/10 transition-colors cursor-pointer group"
                onClick={() => setPromoEmails(!promoEmails)}
              >
                 <div>
                    <p className="text-sm font-bold group-hover:text-brand transition-colors">E-mails de Promoção</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Receba cupons de desconto e dicas de manutenção.</p>
                 </div>
                 <div 
                   className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${promoEmails ? 'bg-[#b85c45]' : 'bg-slate-200'}`}
                 >
                   <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${promoEmails ? 'translate-x-5' : 'translate-x-0'}`} />
                 </div>
              </div>
           </div>
        </section>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-6 pt-4">
           <button 
             className="text-sm font-bold text-muted-foreground hover:text-brand transition-colors"
             onClick={() => {
               setWhatsappNotifications(true);
               setPromoEmails(false);
             }}
           >
              Cancelar Alterações
           </button>
           <Button 
             onClick={handleSaveAll}
             disabled={isSaving}
             className="w-full sm:w-auto h-14 rounded-full bg-[#1a1513] hover:bg-black text-white px-12 font-bold shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
           >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </div>
              ) : "Salvar Tudo"}
           </Button>
        </div>
      </div>

      {/* Toast Notification */}
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
