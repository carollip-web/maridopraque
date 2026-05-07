import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  BarChart3, 
  Wrench, 
  Users, 
  ShoppingBag, 
  DollarSign, 
  ShieldCheck, 
  FileText, 
  Settings,
  ChevronRight,
  Search,
  Bell,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  component: AdminArea,
});

type AdminTab = "dashboard" | "pedidos" | "profissionais" | "servicos" | "clientes" | "financeiro" | "config";

function AdminArea() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "pedidos", label: "Gestão de Pedidos", icon: ShoppingBag },
    { id: "profissionais", label: "Profissionais", icon: Wrench },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "servicos", label: "Serviços", icon: FileText },
    { id: "financeiro", label: "Financeiro", icon: DollarSign },
    { id: "config", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#0F172A] text-white shrink-0 z-30 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="h-8 w-8 bg-brand rounded-lg flex items-center justify-center">
             <Wrench className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold tracking-tight text-lg">Admin Panel</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as AdminTab)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.id 
                ? "bg-brand text-white" 
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
           <div className="flex items-center gap-3 px-2 py-2">
              <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">AD</div>
              <div className="flex-1 overflow-hidden">
                 <p className="text-xs font-bold truncate">Admin Master</p>
                 <p className="text-[10px] text-slate-500 truncate">admin@maridopraque.com</p>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="relative w-96 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por pedidos, profissionais..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-brand/20 outline-none"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Bell className="h-5 w-5 text-slate-600" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
            </button>
            <Button size="sm" className="bg-brand text-white rounded-lg gap-2">
              <Plus className="h-4 w-4" /> Novo Serviço
            </Button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full">
           {activeTab === "dashboard" && <AdminDashboard />}
           {activeTab === "pedidos" && <AdminPedidos />}
           {activeTab === "profissionais" && <AdminProfissionais />}
           {activeTab === "clientes" && <AdminClientes />}
           {activeTab === "servicos" && <AdminServicos />}
           {activeTab === "financeiro" && <AdminFinanceiro />}
           {activeTab === "config" && <AdminConfig />}
        </div>
      </main>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
         <div>
            <h1 className="text-2xl font-bold text-slate-900">Visão Geral</h1>
            <p className="text-sm text-slate-500 mt-1">Dados atualizados em tempo real.</p>
         </div>
         <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-lg bg-white">Últimos 30 dias</Button>
            <Button variant="outline" size="sm" className="rounded-lg bg-white">Exportar</Button>
         </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Receita Total", value: "R$ 42.850", diff: "+12.5%", up: true, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Serviços Ativos", value: "84", diff: "+5.2%", up: true, icon: ShoppingBag, color: "text-brand", bg: "bg-brand-soft" },
          { label: "Novos Clientes", value: "128", diff: "+18.3%", up: true, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Média de Avaliação", value: "4.9/5", diff: "-0.1%", up: false, icon: CheckCircle2, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
               <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
               </div>
               <div className={`flex items-center gap-1 text-xs font-bold ${stat.up ? "text-green-600" : "text-red-600"}`}>
                  {stat.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {stat.diff}
               </div>
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        {/* Orders Table Preview */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Últimos Pedidos</h3>
            <button className="text-xs font-bold text-brand hover:underline">Ver todos</button>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                   <tr>
                      <th className="px-6 py-3">Cliente / ID</th>
                      <th className="px-6 py-3">Serviço</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Valor</th>
                      <th className="px-6 py-3 text-right"></th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {[
                     { id: "#4092", user: "Carolina Silva", service: "Instalação Chuveiro", status: "Em Progresso", color: "text-blue-600", bg: "bg-blue-50", price: "R$ 80" },
                     { id: "#4091", user: "Marcos Oliveira", service: "Montagem de Cama", status: "Pendente", color: "text-amber-600", bg: "bg-amber-50", price: "R$ 120" },
                     { id: "#4090", user: "Júlia Costa", service: "Pintura Parede", status: "Concluído", color: "text-green-600", bg: "bg-green-50", price: "R$ 450" },
                     { id: "#4089", user: "Roberto Nunes", service: "Reparo Torneira", status: "Agendado", color: "text-purple-600", bg: "bg-purple-50", price: "R$ 70" },
                   ].map((order) => (
                     <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                           <p className="text-sm font-bold text-slate-900">{order.user}</p>
                           <p className="text-[10px] text-slate-500">{order.id}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{order.service}</td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${order.bg} ${order.color}`}>
                              {order.status}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{order.price}</td>
                        <td className="px-6 py-4 text-right">
                           <button className="p-1.5 hover:bg-slate-200 rounded-md transition-colors">
                              <MoreHorizontal className="h-4 w-4 text-slate-400" />
                           </button>
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </section>

        {/* Quick Management */}
        <section className="space-y-6">
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-6">Profissionais em Destaque</h3>
              <div className="space-y-4">
                 {[
                   { name: "Mariana S.", jobs: 142, rating: 5.0, status: "Ativo" },
                   { name: "Ricardo M.", jobs: 98, rating: 4.8, status: "Ativo" },
                   { name: "Juliana P.", jobs: 76, rating: 4.9, status: "Ativo" },
                 ].map((prof) => (
                    <div key={prof.name} className="flex items-center gap-3">
                       <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs">{prof.name[0]}</div>
                       <div className="flex-1">
                          <p className="text-sm font-bold">{prof.name}</p>
                          <p className="text-[10px] text-slate-500">{prof.jobs} serviços • ⭐ {prof.rating}</p>
                       </div>
                       <div className="h-2 w-2 rounded-full bg-green-500" />
                    </div>
                 ))}
              </div>
              <Button variant="outline" className="w-full mt-6 rounded-lg text-xs font-bold uppercase">Ver todos</Button>
           </div>

           <div className="bg-[#0F172A] p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
              <ShieldCheck className="absolute -right-4 -bottom-4 h-24 w-24 text-white/5" />
              <h4 className="font-bold text-lg mb-2">Verificações Pendentes</h4>
              <p className="text-sm text-slate-400 mb-6">4 novos profissionais aguardam análise de documentos.</p>
              <Button className="w-full bg-brand text-white border-none rounded-lg font-bold">Analisar Agora</Button>
           </div>
        </section>
      </div>
    </div>
  );
}

function AdminPedidos() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Todos os Pedidos</h2>
          <div className="flex gap-2">
             <Button variant="outline" className="rounded-lg gap-2"><Filter className="h-4 w-4" /> Filtros</Button>
             <Button className="bg-brand text-white rounded-lg px-6">Agendar Novo</Button>
          </div>
       </div>

       <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex gap-4 overflow-x-auto no-scrollbar">
             {["Todos", "Pendentes", "Em Progresso", "Agendados", "Concluídos", "Cancelados"].map((tab, i) => (
                <button key={tab} className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${i === 0 ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}>
                   {tab}
                </button>
             ))}
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                   <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Serviço</th>
                      <th className="px-6 py-4">Profissional</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4 text-right"></th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {[
                     { id: "#4092", user: "Carolina Silva", service: "Chuveiro", prof: "Mariana S.", status: "Em Progresso", color: "text-blue-600", bg: "bg-blue-50", date: "Hoje, 14:00" },
                     { id: "#4091", user: "Marcos Oliveira", service: "Cama", prof: "-", status: "Pendente", color: "text-amber-600", bg: "bg-amber-50", date: "Hoje, 12:45" },
                     { id: "#4090", user: "Júlia Costa", service: "Pintura", prof: "Ricardo M.", status: "Concluído", color: "text-green-600", bg: "bg-green-50", date: "Ontem" },
                   ].map((order) => (
                     <tr key={order.id} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                        <td className="px-6 py-4 text-xs font-bold text-slate-400 group-hover:text-brand">{order.id}</td>
                        <td className="px-6 py-4 text-sm font-bold">{order.user}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{order.service}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{order.prof}</td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${order.bg} ${order.color}`}>
                              {order.status}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{order.date}</td>
                        <td className="px-6 py-4 text-right">
                           <button className="p-1.5 hover:bg-slate-200 rounded-md transition-colors">
                              <MoreHorizontal className="h-4 w-4 text-slate-400" />
                           </button>
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
       </div>
    </div>
  );
}

function AdminProfissionais() {
  const pros = [
    { name: "Mariana Silva", category: "Pequenos Reparos", rating: 5.0, earnings: "R$ 4.250", status: "Disponível", avatar: "MS" },
    { name: "Ricardo Mendes", category: "Montagem de Móveis", rating: 4.8, earnings: "R$ 3.820", status: "Em Serviço", avatar: "RM" },
    { name: "Juliana Peixoto", category: "Elétrica Básica", rating: 4.9, earnings: "R$ 5.100", status: "Disponível", avatar: "JP" },
    { name: "Carlos Andrade", category: "Hidráulica", rating: 4.5, earnings: "R$ 2.900", status: "Inativo", avatar: "CA" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Gestão de Profissionais</h2>
          <Button className="bg-brand text-white rounded-lg">+ Cadastrar Profissional</Button>
       </div>

       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {pros.map((pro) => (
             <div key={pro.name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center relative group">
                <div className="absolute top-4 right-4">
                   <div className={`h-2 w-2 rounded-full ${pro.status === "Inativo" ? "bg-slate-300" : "bg-green-500"}`} />
                </div>
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-xl font-bold mx-auto mb-4 group-hover:bg-brand group-hover:text-white transition-colors">
                   {pro.avatar}
                </div>
                <h3 className="font-bold text-slate-900">{pro.name}</h3>
                <p className="text-xs text-slate-500 mb-4">{pro.category}</p>
                <div className="flex items-center justify-center gap-1 mb-6">
                   <span className="text-sm font-bold">⭐ {pro.rating}</span>
                </div>
                <div className="flex justify-between items-center text-left border-t border-slate-50 pt-4">
                   <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Ganhos (Mês)</p>
                      <p className="text-sm font-bold text-slate-900">{pro.earnings}</p>
                   </div>
                   <button className="text-brand p-1.5 hover:bg-brand-soft rounded-lg transition-colors">
                      <ChevronRight className="h-4 w-4" />
                   </button>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
}

function AdminClientes() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold">Lista de Clientes</h2>
          <Search className="h-4 w-4 text-slate-400" />
       </div>
       <div className="space-y-6">
          {[
            { name: "Carolina Lima Silva", email: "carolina@email.com", location: "Ipanema, RJ", total: 12, joined: "Abril 2026" },
            { name: "João Pedro Ferreira", email: "joao.pedro@email.com", location: "Barra, RJ", total: 4, joined: "Maio 2026" },
            { name: "Mariana Oliveira", email: "mari.oli@email.com", location: "Leblon, RJ", total: 8, joined: "Março 2026" },
          ].map((c) => (
             <div key={c.email} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                   <div className="h-10 w-10 rounded-full bg-brand-soft text-brand flex items-center justify-center font-bold text-sm">
                      {c.name[0]}
                   </div>
                   <div>
                      <h4 className="font-bold text-sm group-hover:text-brand transition-colors">{c.name}</h4>
                      <p className="text-xs text-slate-500">{c.email} • {c.location}</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-xs font-bold text-slate-900">{c.total} pedidos</p>
                   <p className="text-[10px] text-slate-400 italic">Desde {c.joined}</p>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
}
function AdminServicos() {
  const categories = [
    { name: "Pequenos Reparos", count: 24, icon: Wrench },
    { name: "Elétrica", count: 18, icon: Zap },
    { name: "Hidráulica", count: 12, icon: Droplets },
    { name: "Montagem", count: 15, icon: LayoutGrid },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Catálogo de Serviços</h2>
          <Button className="bg-brand text-white rounded-lg">+ Novo Serviço</Button>
       </div>

       <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => (
             <div key={cat.name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group">
                <div className="h-12 w-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-colors">
                   <cat.icon className="h-6 w-6" />
                </div>
                <div>
                   <p className="font-bold text-slate-900">{cat.name}</p>
                   <p className="text-xs text-slate-500">{cat.count} itens ativos</p>
                </div>
             </div>
          ))}
       </div>

       <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
             <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <tr>
                   <th className="px-6 py-4">Nome do Serviço</th>
                   <th className="px-6 py-4">Categoria</th>
                   <th className="px-6 py-4">Preço Médio</th>
                   <th className="px-6 py-4">Popolaridade</th>
                   <th className="px-6 py-4 text-right">Status</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {[
                  { name: "Troca de Resistência", cat: "Elétrica", price: "R$ 80", pop: "Alta", status: "Ativo" },
                  { name: "Instalação de Chuveiro", cat: "Hidráulica", price: "R$ 120", pop: "Alta", status: "Ativo" },
                  { name: "Montagem de Cama", cat: "Montagem", price: "R$ 150", pop: "Média", status: "Ativo" },
                  { name: "Pintura de Parede (m²)", cat: "Reparos", price: "R$ 45", pop: "Média", status: "Inativo" },
                ].map((s) => (
                   <tr key={s.name} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold">{s.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{s.cat}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{s.price}</td>
                      <td className="px-6 py-4">
                         <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full bg-brand ${s.pop === "Alta" ? "w-full" : "w-1/2"}`} />
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${s.status === "Ativo" ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-400"}`}>
                            {s.status}
                         </span>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  );
}

function AdminFinanceiro() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Relatório Financeiro</h2>
          <Button variant="outline" className="rounded-lg">Baixar Relatório Completo</Button>
       </div>

       <div className="grid gap-6 md:grid-cols-3">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
             <p className="text-sm text-slate-500 mb-1">Volume Bruto (Mês)</p>
             <h3 className="text-3xl font-bold">R$ 52.120,40</h3>
             <div className="mt-4 flex items-center gap-1 text-green-600 text-xs font-bold">
                <ArrowUpRight className="h-3 w-3" /> +8.4% vs mês anterior
             </div>
          </div>
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
             <p className="text-sm text-slate-500 mb-1">Líquido Plataforma</p>
             <h3 className="text-3xl font-bold">R$ 10.424,08</h3>
             <div className="mt-4 flex items-center gap-1 text-green-600 text-xs font-bold">
                <ArrowUpRight className="h-3 w-3" /> Taxa média: 20%
             </div>
          </div>
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
             <p className="text-sm text-slate-500 mb-1">Pagamentos Pendentes</p>
             <h3 className="text-3xl font-bold">R$ 4.150,00</h3>
             <div className="mt-4 flex items-center gap-1 text-amber-600 text-xs font-bold">
                <Clock className="h-3 w-3" /> 8 transações em análise
             </div>
          </div>
       </div>

       <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-100 font-bold">Fluxo de Caixa Recente</div>
          <div className="p-6 space-y-6">
             {[
               { t: "Pagamento de Serviço #4092", v: "+ R$ 80,00", d: "Hoje, 14:30", s: "Concluído", c: "text-green-600" },
               { t: "Repasse Profissional: Mariana S.", v: "- R$ 64,00", d: "Hoje, 10:00", s: "Processado", c: "text-slate-900" },
               { t: "Pagamento de Serviço #4088", v: "+ R$ 150,00", d: "Ontem", s: "Concluído", c: "text-green-600" },
             ].map((f, i) => (
                <div key={i} className="flex justify-between items-center border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                   <div>
                      <p className="text-sm font-bold">{f.t}</p>
                      <p className="text-xs text-slate-400">{f.d} • {f.s}</p>
                   </div>
                   <p className={`font-bold ${f.c}`}>{f.v}</p>
                </div>
             ))}
          </div>
       </section>
    </div>
  );
}

function AdminConfig() {
  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <h2 className="text-2xl font-bold">Configurações do Sistema</h2>

       <div className="space-y-6">
          <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
             <h3 className="font-bold mb-6 text-slate-900">Configurações Gerais</h3>
             <div className="space-y-4">
                <div className="grid gap-2">
                   <label className="text-xs font-bold uppercase text-slate-500">Número Principal (WhatsApp)</label>
                   <input type="text" defaultValue="+55 (21) 99999-9999" className="p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-brand outline-none" />
                </div>
                <div className="grid gap-2">
                   <label className="text-xs font-bold uppercase text-slate-500">E-mail de Notificações</label>
                   <input type="email" defaultValue="contato@maridopraque.com" className="p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-brand outline-none" />
                </div>
             </div>
          </section>

          <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
             <h3 className="font-bold mb-6 text-slate-900">Taxas e Repasses</h3>
             <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                   <p className="text-sm font-bold">Comissão da Plataforma</p>
                   <p className="text-xs text-slate-500">Porcentagem retida em cada serviço.</p>
                </div>
                <div className="flex items-center gap-2">
                   <input type="number" defaultValue="20" className="w-16 p-2 rounded-lg border border-slate-200 text-center font-bold" />
                   <span className="font-bold text-slate-500">%</span>
                </div>
             </div>
          </section>

          <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
             <h3 className="font-bold mb-6 text-slate-900">Segurança do Painel</h3>
             <Button variant="outline" className="w-full rounded-lg py-6 border-dashed text-slate-400 hover:text-brand transition-colors">
                Atualizar Senha Administrativa
             </Button>
          </section>

          <div className="flex justify-end">
             <Button className="bg-brand text-white rounded-lg px-10 h-12 font-bold shadow-lg">Salvar Configurações</Button>
          </div>
       </div>
    </div>
  );
}

// Additional icons for Services
const Zap = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.71 14.71 4l-2.82 9.42 8.11-1.41-10.71 10.71 2.82-9.42z"/></svg>
const Droplets = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16.3c2.2 0 4-1.8 4-4 0-3.3-4-8-4-8s-4 4.7-4 8c0 2.2 1.8 4 4 4Z"/><path d="M17 21.3c1.6 0 3-1.4 3-3 0-2.5-3-6-3-6s-3 3.5-3 6c0 1.6 1.4 3 3 3Z"/></svg>
const LayoutGrid = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
