import { createFileRoute, Link } from "@tanstack/react-router";
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
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cliente")({
  component: ClienteArea,
});

type Tab = "inicio" | "pedidos" | "servicos" | "pagamentos" | "dados";

function ClienteArea() {
  const [activeTab, setActiveTab] = useState<Tab>("inicio");

  const sidebarItems = [
    { id: "inicio", label: "Dashboard", icon: LayoutDashboard },
    { id: "pedidos", label: "Pedidos e Orçamentos", icon: ClipboardList },
    { id: "servicos", label: "Histórico de Serviços", icon: History },
    { id: "pagamentos", label: "Pagamentos", icon: CreditCard },
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
        </nav>

        <div className="mt-auto p-4 border-t border-border hidden md:block">
           <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
             <LogOut className="h-4 w-4" />
             Sair da conta
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 max-w-6xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {sidebarItems.find(i => i.id === activeTab)?.label}
            </h1>
            <p className="text-muted-foreground mt-1">Bem-vinda de volta, Carolina!</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="relative p-2.5 rounded-full border border-border bg-white hover:bg-muted transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-brand border-2 border-white" />
            </button>
            <div className="h-10 w-10 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold">
              C
            </div>
          </div>
        </header>

        {activeTab === "inicio" && <DashboardTab />}
        {activeTab === "pedidos" && <PedidosTab />}
        {activeTab === "servicos" && <ServicosTab />}
        {activeTab === "pagamentos" && <PagamentosTab />}
        {activeTab === "dados" && <DadosTab />}
      </main>
    </div>
  );
}

function DashboardTab() {
  const [showBanner, setShowBanner] = useState(true);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Serviços Realizados", value: "12", icon: CheckCircle2, color: "text-green-600" },
          { label: "Pedidos Ativos", value: "2", icon: Clock, color: "text-brand" },
          { label: "Orçamentos Pendentes", value: "1", icon: AlertCircle, color: "text-amber-500" },
          { label: "Total Investido", value: "R$ 2.450", icon: CreditCard, color: "text-slate-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-3xl border border-border shadow-soft">
            <div className={`h-10 w-10 rounded-2xl bg-muted flex items-center justify-center mb-4 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* Recent Activity */}
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold">Atividade Recente</h2>
            <button className="text-sm font-semibold text-brand hover:underline">Ver tudo</button>
          </div>
          <div className="space-y-6">
            {[
              { title: "Instalação de Chuveiro", status: "Concluído", date: "Ontem, 14:30", type: "servico" },
              { title: "Orçamento: Pintura Sala", status: "Aguardando aprovação", date: "Há 2 dias", type: "orcamento" },
              { title: "Montagem de Guarda-roupa", status: "Agendado para 10/05", date: "Há 3 dias", type: "pedido" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 group cursor-pointer">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Buscar por ID ou serviço..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl px-4">Filtrar</Button>
          <Button className="rounded-xl px-4 bg-brand text-brand-foreground">Novo Pedido</Button>
        </div>
      </div>

      <div className="grid gap-6">
        {pedidos.map((p) => (
          <div key={p.id} className="bg-white p-7 rounded-[2rem] border border-border shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-lg transition-all cursor-pointer group">
            <div className="flex items-start gap-5">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 ${
                p.status === "Agendado" ? "bg-blue-50 text-blue-600" : 
                p.status === "Em Análise" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-600"
              }`}>
                {p.id}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-lg">{p.title}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    p.status === "Agendado" ? "bg-green-100 text-green-700" : 
                    p.status === "Em Análise" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"
                  }`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">{p.description}</p>
                <div className="flex items-center gap-4 mt-3">
                   <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {p.date}
                   </div>
                   {p.prof !== "-" && (
                     <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Wrench className="h-3.5 w-3.5" /> {p.prof}
                     </div>
                   )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-8 justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
              <div className="text-left md:text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Investimento</p>
                <p className="text-xl font-bold text-foreground">{p.price}</p>
              </div>
              <div className="flex gap-2">
                {p.status === "Aguardando Aprovação" && (
                  <Button size="sm" className="rounded-full bg-brand text-brand-foreground h-9 px-4">Aprovar</Button>
                )}
                <Button variant="outline" size="icon" className="rounded-full h-9 w-9 group-hover:bg-brand group-hover:text-brand-foreground transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
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
             <div className="flex items-center justify-between p-4 rounded-xl border border-border border-dashed hover:border-brand transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                   <Plus className="h-5 w-5 text-muted-foreground" />
                   <span className="text-sm font-medium text-muted-foreground">Adicionar novo método</span>
                </div>
             </div>
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

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_2fr] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Profile Sidebar */}
      <div className="space-y-6">
        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft text-center">
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="w-full h-full rounded-full bg-brand/10 border-2 border-brand/20 flex items-center justify-center text-brand text-3xl font-bold">
              C
            </div>
            <button className="absolute bottom-0 right-0 p-2 rounded-full bg-foreground text-background shadow-lg border-2 border-white transition hover:scale-110">
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <h3 className="text-xl font-bold">Carolina L. Silva</h3>
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
              <Button variant="outline" className="w-full rounded-xl justify-between text-xs font-bold py-6 group">
                Alterar Senha
                <ChevronRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" className="w-full rounded-xl justify-between text-xs font-bold py-6 group">
                Autenticação em 2 Fatores
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Desativado</span>
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
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingProfile(false)}>Cancelar</Button>
                    <Button size="sm" className="bg-brand text-white rounded-full px-6 font-bold" onClick={() => setIsEditingProfile(false)}>Salvar</Button>
                 </div>
              )}
           </div>
           
           {!isEditingProfile ? (
              <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 animate-in fade-in duration-300">
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome Completo</label>
                   <p className="text-sm font-medium pb-2 border-b border-slate-100">Carolina Lima Silva</p>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">CPF</label>
                   <p className="text-sm font-medium pb-2 border-b border-slate-100">***.442.***-89</p>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp</label>
                   <p className="text-sm font-medium pb-2 border-b border-slate-100">(21) 98822-1100</p>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">E-mail Principal</label>
                   <p className="text-sm font-medium pb-2 border-b border-slate-100">carolina@email.com</p>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data de Nascimento</label>
                   <p className="text-sm font-medium pb-2 border-b border-slate-100">12/08/1992</p>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Gênero</label>
                   <p className="text-sm font-medium pb-2 border-b border-slate-100">Feminino</p>
                 </div>
              </div>
           ) : (
              <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 animate-in fade-in duration-300">
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome Completo</label>
                   <input type="text" defaultValue="Carolina Lima Silva" className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none focus:border-brand transition-colors bg-transparent" />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">CPF</label>
                   <input type="text" defaultValue="111.222.333-44" disabled className="w-full text-sm font-medium pb-2 border-b border-slate-100 text-slate-400 bg-transparent cursor-not-allowed" />
                   <p className="text-[10px] text-muted-foreground">O CPF não pode ser alterado.</p>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp</label>
                   <input type="text" defaultValue="(21) 98822-1100" className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none focus:border-brand transition-colors bg-transparent" />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">E-mail Principal</label>
                   <input type="email" defaultValue="carolina@email.com" className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none focus:border-brand transition-colors bg-transparent" />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data de Nascimento</label>
                   <input type="date" defaultValue="1992-08-12" className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none focus:border-brand transition-colors bg-transparent" />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Gênero</label>
                   <select className="w-full text-sm font-medium pb-2 border-b border-brand focus:outline-none focus:border-brand transition-colors bg-transparent appearance-none">
                      <option value="Feminino">Feminino</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Outro">Outro</option>
                      <option value="Prefiro não informar">Prefiro não informar</option>
                   </select>
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

        <section className="bg-white rounded-[2rem] border border-border p-8 shadow-soft">
           <div className="flex items-center gap-3 mb-6">
              <Bell className="h-5 w-5 text-brand" />
              <h3 className="font-bold text-lg">Preferências de Contato</h3>
           </div>
           <div className="space-y-4">
              {[
                { t: "Notificações via WhatsApp", d: "Avisos de agendamento e chegada do profissional.", active: true },
                { t: "E-mails de Promoção", d: "Receba cupons de desconto e dicas de manutenção.", active: false },
              ].map(pref => (
                <div key={pref.t} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50">
                   <div>
                      <p className="text-sm font-bold">{pref.t}</p>
                      <p className="text-[10px] text-muted-foreground">{pref.d}</p>
                   </div>
                   <div className={`h-6 w-11 rounded-full p-1 transition-colors cursor-pointer ${pref.active ? "bg-brand" : "bg-slate-300"}`}>
                      <div className={`h-4 w-4 rounded-full bg-white transition-transform ${pref.active ? "translate-x-5" : "translate-x-0"}`} />
                   </div>
                </div>
              ))}
           </div>
        </section>

        <div className="pt-4 flex justify-end gap-4">
           <Button variant="ghost" className="rounded-full font-bold text-muted-foreground">Cancelar Alterações</Button>
           <Button className="rounded-full px-8 bg-foreground text-background hover:bg-foreground/90 font-bold shadow-lg">Salvar Tudo</Button>
        </div>
      </div>
    </div>
  );
}
