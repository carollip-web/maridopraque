import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  ArrowUpRight,
  Filter,
  Calendar,
  Clock,
  AlertCircle,
  Loader2,
  LogOut,
  Star,
  Mail,
  Trash2,
  UserCog,
  Lock,
  UserPlus,
  Crown,
  X,
  Database,
  TestTube,
} from "lucide-react";
import { AdminModoTeste } from "@/components/AdminModoTeste";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AdminMetrics } from "@/components/AdminMetrics";
import { useAuth, type AdminSection, type AdminLevel } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin")({
  component: AdminArea,
  head: () => ({ meta: [{ title: "Admin · Marido pra Quê?" }] }),
});

const ADMIN_LEVEL_LABELS: Record<NonNullable<AdminLevel>, { label: string; color: string; icon: React.ElementType }> = {
  super_admin: { label: "Super Admin",  color: "text-red-600 bg-red-50",    icon: Crown },
  admin:       { label: "Admin",        color: "text-orange-600 bg-orange-50", icon: ShieldCheck },
  financeiro:  { label: "Financeiro",   color: "text-yellow-600 bg-yellow-50", icon: DollarSign },
  suporte:     { label: "Suporte",      color: "text-blue-600 bg-blue-50",   icon: Users },
};

const ALL_SIDEBAR_ITEMS: { id: AdminSection; label: string; icon: React.ElementType }[] = [
  { id: "dashboard",     label: "Dashboard",         icon: BarChart3 },
  { id: "pedidos",       label: "Gestão de Pedidos", icon: ShoppingBag },
  { id: "profissionais", label: "Profissionais",      icon: Wrench },
  { id: "clientes",      label: "Clientes",           icon: Users },
  { id: "servicos",      label: "Serviços",           icon: FileText },
  { id: "financeiro",    label: "Financeiro",         icon: DollarSign },
  { id: "config",        label: "Configurações",      icon: Settings },
  { id: "equipe",        label: "Equipe Admin",       icon: UserCog },
  { id: "modo_teste",    label: "Modo Teste",         icon: TestTube },
];

function AdminArea() {
  const { isLoggedIn, isAdmin, isSuperAdmin, adminLevel, loading, profile, user, logout, canAccess, allowedTabs } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminSection>("dashboard");
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn) {
      navigate({ to: "/login" });
    } else if (!isAdmin) {
      toast.error("Acesso restrito a administradores.");
      navigate({ to: "/cliente", search: { tab: "inicio", id: undefined, pedidoId: undefined, chat: undefined, details: false } as any });
    }
  }, [loading, isLoggedIn, isAdmin, navigate]);

  // When tabs load, set to first allowed tab if current isn't allowed
  useEffect(() => {
    if (!loading && allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [loading, allowedTabs, activeTab]);

  if (loading || !isLoggedIn || !isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const sidebarItems = ALL_SIDEBAR_ITEMS.filter((item) => canAccess(item.id));
  const levelMeta = adminLevel ? ADMIN_LEVEL_LABELS[adminLevel] : null;

  const adminEmail = profile?.email ?? user?.email ?? "";
  const initials = (profile?.nome || adminEmail || "AD")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans">
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
              onClick={() => setActiveTab(item.id)}
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

        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">{initials}</div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate">{profile?.nome || "Administrador"}</p>
              <p className="text-[10px] text-slate-500 truncate">{adminEmail}</p>
              {levelMeta && (
                <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${levelMeta.color}`}>
                  <levelMeta.icon className="h-2.5 w-2.5" />
                  {levelMeta.label}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={async () => { await logout(); navigate({ to: "/login" }); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="hidden md:block text-sm text-slate-500">
            Painel administrativo · {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </div>
          <div className="flex items-center gap-4">
            <Link to="/cliente" search={{ tab: "inicio" } as any} className="text-xs font-bold text-slate-500 hover:text-brand">
              Ver app como cliente
            </Link>
            <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Bell className="h-5 w-5 text-slate-600" />
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full">
          {activeTab === "dashboard"     && canAccess("dashboard")     && <AdminMetrics onTabChange={setActiveTab} />}
          {activeTab === "pedidos"        && canAccess("pedidos")        && <AdminPedidos />}
          {activeTab === "profissionais"  && canAccess("profissionais")  && <AdminProfissionais />}
          {activeTab === "clientes"       && canAccess("clientes")       && <AdminClientes />}
          {activeTab === "servicos"       && canAccess("servicos")       && <AdminServicos />}
          {activeTab === "financeiro"     && canAccess("financeiro")     && <AdminFinanceiro />}
          {activeTab === "config"         && canAccess("config")         && <AdminConfig />}
          {activeTab === "equipe"         && isSuperAdmin                && <AdminEquipe />}
          {activeTab === "modo_teste"     && isSuperAdmin                && <AdminModoTeste />}
        </div>
      </main>
    </div>
  );
}

/* ============== PEDIDOS ============== */

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  customizado_pendente: { bg: "bg-amber-50", color: "text-amber-700", label: "Pendente" },
  enviado: { bg: "bg-sky-50", color: "text-sky-700", label: "Proposta Enviada" },
  aprovado: { bg: "bg-blue-50", color: "text-blue-700", label: "Aprovado" },
  pago: { bg: "bg-emerald-50", color: "text-emerald-700", label: "Pago" },
  agendado: { bg: "bg-indigo-50", color: "text-indigo-700", label: "Agendado" },
  concluido: { bg: "bg-green-50", color: "text-green-700", label: "Concluído" },
  recusado: { bg: "bg-red-50", color: "text-red-700", label: "Recusado" },
  cancelado: { bg: "bg-slate-100", color: "text-slate-600", label: "Cancelado" },
  fixo_auto: { bg: "bg-violet-50", color: "text-violet-700", label: "Auto-aprovado" },
};

function AdminPedidos() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/admin" }) as any;
  const search = searchParams.q || "";
  const filter = searchParams.status || "todos";

  const setSearch = (val: string) => navigate({ search: (old: any) => ({ ...old, q: val || undefined }) });
  const setFilter = (val: string) => navigate({ search: (old: any) => ({ ...old, status: val || "todos" }) });
  const clearFilters = () => navigate({ search: (old: any) => ({ tab: old.tab }) });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "orcamentos"],
    queryFn: async () => {
      const { data: orcs } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("is_test", false)
        .order("created_at", { ascending: false })
        .limit(200);
      
      const list = orcs || [];
      const ids = Array.from(new Set(list.flatMap((o: any) => [o.cliente_id, o.profissional_id]).filter(Boolean)));
      
      let profileMap: Record<string, any> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, nome, email").in("id", ids);
        profileMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
      }
      
      return { orcamentos: list, profiles: profileMap };
    }
  });

  const orcamentos = data?.orcamentos || [];
  const profiles = data?.profiles || {};

  const filtered = useMemo(() => {
    return orcamentos.filter((o) => {
      if (filter !== "todos" && o.status !== filter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      const cliente = profiles[o.cliente_id]?.nome?.toLowerCase() || "";
      const profissional = o.profissional_id ? (profiles[o.profissional_id]?.nome?.toLowerCase() || "") : "";
      return (
        o.id.toLowerCase().includes(q) ||
        o.service_name?.toLowerCase().includes(q) ||
        cliente.includes(q) ||
        profissional.includes(q)
      );
    });
  }, [orcamentos, filter, search, profiles]);

  const tabs = [
    { id: "todos", label: `Todos (${orcamentos.length})` },
    { id: "customizado_pendente", label: `Pendentes (${orcamentos.filter(o => o.status === "customizado_pendente").length})` },
    { id: "enviado", label: `Enviados (${orcamentos.filter(o => o.status === "enviado").length})` },
    { id: "aprovado", label: `Aprovados (${orcamentos.filter(o => o.status === "aprovado").length})` },
    { id: "pago", label: `Pagos (${orcamentos.filter(o => o.status === "pago").length})` },
    { id: "agendado", label: `Agendados (${orcamentos.filter(o => o.status === "agendado").length})` },
    { id: "concluido", label: `Concluídos (${orcamentos.filter(o => o.status === "concluido").length})` },
    { id: "cancelado", label: `Cancelados (${orcamentos.filter(o => o.status === "cancelado").length})` },
    { id: "recusado", label: `Recusados (${orcamentos.filter(o => o.status === "recusado").length})` },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Todos os Pedidos</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, serviço..."
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 outline-none"
            />
          </div>
          </div>
          {(search || filter !== "todos") && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500 hover:text-red-500 gap-1 px-2">
              <X className="h-4 w-4" /> Limpar
            </Button>
          )}
          <Button variant="outline" className="rounded-lg gap-2" onClick={() => refetch()}>
            <Filter className="h-4 w-4" /> Atualizar
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
                filter === t.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {t.label}
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
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-md" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                    </tr>
                  ))}
                </>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">Nenhum pedido encontrado.</td></tr>
              )}
              {!isLoading && filtered.map((o) => {
                const meta = STATUS_COLORS[o.status] ?? { bg: "bg-slate-100", color: "text-slate-600", label: o.status };
                const cli = profiles[o.cliente_id];
                const prof = o.profissional_id ? profiles[o.profissional_id] : null;
                return (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">#{o.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-sm font-bold">{cli?.nome || "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{o.service_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{prof?.nome || "—"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-tight inline-block ${meta.bg} ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">
                      {o.valor && Number(o.valor) > 0 ? `R$ ${Number(o.valor).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(o.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============== PROFISSIONAIS ============== */

function ProDetailView({ proId, view }: { proId: string; view: "ganhos" | "servicos" | "nota" }) {
  const { data: details, isLoading } = useQuery({
    queryKey: ["admin", "pro-details", proId, view],
    queryFn: async () => {
      if (view === "ganhos" || view === "servicos") {
        const query = supabase
          .from("orcamentos")
          .select("id, created_at, valor, status, service_name, profiles(nome)")
          .eq("profissional_id", proId);
        
        if (view === "ganhos") query.eq("status", "pago");
        const { data } = await query.order("created_at", { ascending: false });
        return data || [];
      } else {
        const { data } = await supabase
          .from("avaliacoes")
          .select("id, nota, comentario, created_at, cliente_id")
          .eq("profissional_id", proId)
          .order("created_at", { ascending: false });
        return data || [];
      }
    }
  });

  if (isLoading) return <div className="mt-4 p-4 bg-white/5 rounded-xl animate-pulse text-white/50 text-xs">Carregando detalhes...</div>;

  return (
    <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10 space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
      {details?.length === 0 && <p className="text-xs text-white/40 text-center py-4">Nenhum registro encontrado.</p>}
      
      {view === "nota" ? (
        (details as any[]).map((av) => (
          <div key={av.id} className="text-left border-b border-white/5 pb-2 last:border-0">
            <div className="flex justify-between items-center mb-1">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`h-2.5 w-2.5 ${i < av.nota ? "fill-amber-400 text-amber-400" : "text-white/20"}`} />
                ))}
              </div>
              <span className="text-[10px] text-white/30">{new Date(av.created_at).toLocaleDateString()}</span>
            </div>
            {av.comentario && <p className="text-xs text-white/70 italic line-clamp-2">"{av.comentario}"</p>}
          </div>
        ))
      ) : (
        (details as any[]).map((orc) => (
          <div key={orc.id} className="flex justify-between items-center text-left border-b border-white/5 pb-2 last:border-0">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate text-white/90">{orc.service_name || "Serviço sem nome"}</p>
              <p className="text-[10px] text-white/40">{new Date(orc.created_at).toLocaleDateString()}</p>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className="text-xs font-bold text-white">R$ {orc.valor || 0}</p>
              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                orc.status === "pago" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"
              }`}>
                {orc.status}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const ESPECIALIDADES_OPCOES = [
  {
    categoria: "Montagem",
    icon: Wrench,
    opcoes: [
      "Montagem de Móveis",
      "Furos e Fixação",
      "Instalação de Prateleiras",
      "Suporte de TV",
      "Instalação de Cortinas",
      "Instalação de Ar-Condicionado",
    ],
  },
  {
    categoria: "Reparos",
    icon: Settings,
    opcoes: [
      "Elétrica Básica",
      "Hidráulica",
      "Resistência de Chuveiro",
      "Reparos Gerais",
      "Pintura",
      "Gesso e Drywall",
      "Fechaduras e Dobradiças",
    ],
  },
  {
    categoria: "Engenharia",
    icon: ShieldCheck,
    opcoes: [
      "Legalização de Projetos",
      "Regularização de Obras",
      "Laudos Técnicos",
      "Segurança do Trabalho",
      "Habite-se e Alvarás",
      "Projetos Arquitetônicos",
    ],
  },
];

function AdminProfissionais() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/admin" }) as any;
  const search = searchParams.pro_q || "";
  const filterStatus = searchParams.pro_status || "todos";

  const setSearch = (val: string) => navigate({ search: (old: any) => ({ ...old, pro_q: val || undefined }) });
  const setFilterStatus = (val: string) => navigate({ search: (old: any) => ({ ...old, pro_status: val || "todos" }) });
  const clearFilters = () => navigate({ search: (old: any) => ({ tab: old.tab }) });
  const [selected, setSelected] = useState<any | null>(null);
  const [editingEsp, setEditingEsp] = useState(false);
  const [espSelected, setEspSelected] = useState<string[]>([]);
  const [savingEsp, setSavingEsp] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [detailView, setDetailView] = useState<"ganhos" | "servicos" | "nota" | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPro, setNewPro] = useState({ nome: "", email: "", password: "" });
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: pros = [], isLoading } = useQuery({
    queryKey: ["admin", "profissionais"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "profissional");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];

      const [{ data: profs }, { data: perfis }, { data: orcs }, { data: avs }] = await Promise.all([
        supabase.from("profiles").select("id, nome, email, whatsapp").in("id", ids),
        supabase.from("profissional_perfil").select("*").in("user_id", ids),
        supabase.from("orcamentos").select("profissional_id, status, valor").in("profissional_id", ids),
        supabase.from("avaliacoes").select("profissional_id, nota").in("profissional_id", ids),
      ]);

      const perfilMap = Object.fromEntries((perfis || []).map((p: any) => [p.user_id, p]));
      const stats: Record<string, { ganhos: number; servicos: number; nota: number; n: number }> = {};
      (orcs || []).forEach((o: any) => {
        if (!o.profissional_id) return;
        stats[o.profissional_id] ||= { ganhos: 0, servicos: 0, nota: 0, n: 0 };
        if (o.status === "pago") {
          stats[o.profissional_id].ganhos += Number(o.valor || 0);
          stats[o.profissional_id].servicos += 1;
        }
      });
      (avs || []).forEach((a: any) => {
        if (!a.profissional_id) return;
        stats[a.profissional_id] ||= { ganhos: 0, servicos: 0, nota: 0, n: 0 };
        stats[a.profissional_id].nota += a.nota;
        stats[a.profissional_id].n += 1;
      });

      return (profs || []).map((p: any) => {
        const s = stats[p.id] || { ganhos: 0, servicos: 0, nota: 0, n: 0 };
        const perfil = perfilMap[p.id];
        return {
          id: p.id,
          nome: p.nome || p.email,
          email: p.email,
          whatsapp: p.whatsapp,
          ativo: perfil?.ativo ?? true,
          especialidades: perfil?.especialidades || [],
          cidade: perfil?.cidade || null,
          bio: perfil?.bio || null,
          slug: perfil?.slug || null,
          ganhos: s.ganhos,
          servicos: s.servicos,
          rating: s.n > 0 ? (s.nota / s.n) : null,
          avaliacoes: s.n,
        };
      });
    }
  });

  const filtered = pros.filter((p) => {
    const matchSearch = !search ||
      p.nome?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      p.especialidades?.some((e: string) => e.toLowerCase().includes(search.toLowerCase()));
    const matchStatus =
      filterStatus === "todos" ||
      (filterStatus === "ativo" && p.ativo) ||
      (filterStatus === "inativo" && !p.ativo);
    return matchSearch && matchStatus;
  });

  const handleToggleAtivo = async (pro: any) => {
    setTogglingId(pro.id);
    const { error } = await supabase
      .from("profissional_perfil")
      .upsert({ 
        user_id: pro.id, 
        ativo: !pro.ativo,
        updated_at: new Date().toISOString()
      });
    setTogglingId(null);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    toast.success(pro.ativo ? "Profissional desativado" : "Profissional ativado");
    qc.invalidateQueries({ queryKey: ["admin", "profissionais"] });
    if (selected?.id === pro.id) setSelected({ ...selected, ativo: !pro.ativo });
  };

  const handleSaveEsp = async () => {
    if (!selected) return;
    setSavingEsp(true);
    const { error } = await supabase
      .from("profissional_perfil")
      .upsert({ 
        user_id: selected.id, 
        especialidades: espSelected,
        updated_at: new Date().toISOString()
      });
    setSavingEsp(false);
    if (error) { toast.error("Erro ao salvar especialidades"); return; }
    toast.success("Especialidades atualizadas");
    setEditingEsp(false);
    qc.invalidateQueries({ queryKey: ["admin", "profissionais"] });
    setSelected({ ...selected, especialidades: espSelected });
  };

  const handleCreatePro = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    const { data, error } = await supabase.functions.invoke("manage-professionals", {
      body: { action: "create", ...newPro }
    });
    setIsCreating(false);
    if (error || data?.error) {
      toast.error("Erro ao criar", { description: error?.message || data?.error });
      return;
    }
    toast.success("Profissional criado com sucesso!");
    setShowAddModal(false);
    setNewPro({ nome: "", email: "", password: "" });
    qc.invalidateQueries({ queryKey: ["admin", "profissionais"] });
  };

  const handleDeletePro = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este profissional? Esta ação é irreversível e removerá todos os dados do usuário.")) return;
    setIsDeleting(true);
    const { data, error } = await supabase.functions.invoke("manage-professionals", {
      body: { action: "delete", user_id: id }
    });
    setIsDeleting(false);
    if (error || data?.error) {
      toast.error("Erro ao excluir", { description: error?.message || data?.error });
      return;
    }
    toast.success("Profissional excluído!");
    setSelected(null);
    qc.invalidateQueries({ queryKey: ["admin", "profissionais"] });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Profissionais</h2>
          <p className="text-sm text-slate-500">{pros.length} cadastrados · {pros.filter(p => p.ativo).length} ativos</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors shrink-0"
          >
            <UserPlus className="h-4 w-4" /> Novo Profissional
          </button>
          <a href="/admin-validacao" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-colors shrink-0">
            🛡️ Validação
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou especialidade…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand/20 outline-none bg-white"
          />
        </div>
        <div className="flex gap-2">
          {[
            { id: "todos", label: `Todos (${pros.length})` },
            { id: "ativo", label: `Ativos (${pros.filter(p => p.ativo).length})` },
            { id: "inativo", label: `Inativos (${pros.filter(p => !p.ativo).length})` },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setFilterStatus(s.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold capitalize transition-all ${
                filterStatus === s.id
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s.label}
            </button>
          ))}
          {(search || filterStatus !== "todos") && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500 hover:text-red-500 gap-1 px-2">
              <X className="h-4 w-4" /> Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* List */}
        <div className={`flex-1 min-w-0 ${selected ? "hidden lg:block" : ""}`}>
          {isLoading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
                  <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              ))}
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              Nenhum profissional encontrado.
            </div>
          )}
          {!isLoading && (
            <div className="space-y-3">
              {filtered.map((pro) => (
                <button
                  key={pro.id}
                  onClick={() => { setSelected(pro); setEditingEsp(false); setDetailView(null); setEspSelected([...pro.especialidades]); }}
                  className={`w-full bg-white rounded-2xl border text-left p-5 flex items-center gap-4 transition-all hover:shadow-md ${
                    selected?.id === pro.id ? "border-brand ring-2 ring-brand/20" : "border-slate-200"
                  }`}
                >
                  <div className={`h-11 w-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${pro.ativo ? "bg-brand-soft text-brand" : "bg-slate-100 text-slate-400"}`}>
                    {pro.nome?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm truncate">{pro.nome}</p>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${pro.ativo ? "bg-green-500" : "bg-slate-300"}`} />
                    </div>
                    <p className="text-xs text-slate-500 truncate">{pro.email}</p>
                    {pro.especialidades.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {pro.especialidades.slice(0, 3).map((e: string) => (
                          <span key={e} className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium">{e}</span>
                        ))}
                        {pro.especialidades.length > 3 && <span className="text-[9px] text-slate-400">+{pro.especialidades.length - 3}</span>}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right hidden sm:block">
                    {pro.rating != null && (
                      <p className="text-sm font-bold flex items-center gap-0.5 text-amber-500">
                        {pro.rating.toFixed(1)} <Star className="h-3 w-3" fill="currentColor" />
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">{pro.servicos} serviço{pro.servicos !== 1 ? "s" : ""}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-full lg:w-96 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm sticky top-20 overflow-hidden">
              {/* Header */}
              <div className="bg-slate-900 p-6 text-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center font-bold text-lg">
                      {selected.nome?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold">{selected.nome}</p>
                      <p className="text-xs text-white/60">{selected.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {/* Stats — clickable cards */}
                <div className="grid grid-cols-3 gap-3 mt-5">
                  {[
                    { key: "ganhos" as const, label: "Ganhos", value: `R$ ${selected.ganhos.toFixed(0)}` },
                    { key: "servicos" as const, label: "Serviços", value: String(selected.servicos) },
                    { key: "nota" as const, label: "Nota", value: selected.rating != null ? `${selected.rating.toFixed(1)} ★` : "—" },
                  ].map(({ key, label, value }) => (
                    <button
                      key={key}
                      onClick={() => setDetailView(detailView === key ? null : key)}
                      className={`rounded-xl p-3 text-center transition-all ${
                        detailView === key
                          ? "bg-white text-slate-900 shadow-sm"
                          : "bg-white/10 hover:bg-white/20 text-white"
                      }`}
                    >
                      <p className={`text-xs ${detailView === key ? "text-slate-500" : "text-white/60"}`}>{label}</p>
                      <p className="font-bold text-sm">{value}</p>
                      <p className={`text-[9px] mt-0.5 ${detailView === key ? "text-brand" : "text-white/40"}`}>
                        {detailView === key ? "fechar ▲" : "ver ▼"}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Inline detail view */}
                {detailView && (
                  <ProDetailView proId={selected.id} view={detailView} />
                )}
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Status toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">Status</p>
                    <p className="text-xs text-slate-400">{selected.ativo ? "Ativo na plataforma" : "Desativado"}</p>
                  </div>
                  <button
                    onClick={() => handleToggleAtivo(selected)}
                    disabled={togglingId === selected.id}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${selected.ativo ? "bg-green-500" : "bg-slate-200"}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${selected.ativo ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>

                {/* Info */}
                {selected.cidade && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Cidade</p>
                    <p className="text-sm">{selected.cidade}</p>
                  </div>
                )}
                {selected.whatsapp && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">WhatsApp</p>
                    <p className="text-sm">{selected.whatsapp}</p>
                  </div>
                )}
                {selected.bio && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Bio</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{selected.bio}</p>
                  </div>
                )}

                {/* Especialidades */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-slate-400 uppercase">Especialidades</p>
                    <button
                      onClick={() => { setEditingEsp(!editingEsp); setEspSelected([...selected.especialidades]); }}
                      className="text-[10px] font-bold text-brand hover:underline"
                    >
                      {editingEsp ? "Cancelar" : "Editar"}
                    </button>
                  </div>
                  {editingEsp ? (
                    <div className="space-y-6">
                      {ESPECIALIDADES_OPCOES.map((cat) => {
                        const allSelected = cat.opcoes.every(opt => espSelected.includes(opt));
                        
                        return (
                          <div key={cat.categoria} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <cat.icon className="h-3.5 w-3.5" /> {cat.categoria}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  if (allSelected) {
                                    setEspSelected(espSelected.filter(e => !cat.opcoes.includes(e)));
                                  } else {
                                    const others = espSelected.filter(e => !cat.opcoes.includes(e));
                                    setEspSelected([...others, ...cat.opcoes]);
                                  }
                                }}
                                className="text-[10px] font-bold text-brand hover:bg-brand/10 px-2 py-1 rounded-md transition-colors"
                              >
                                {allSelected ? "Remover todos" : "Selecionar todos"}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {cat.opcoes.map((esp) => {
                                const checked = espSelected.includes(esp);
                                return (
                                  <button
                                    key={esp}
                                    type="button"
                                    onClick={() => setEspSelected(checked
                                      ? espSelected.filter((e) => e !== esp)
                                      : [...espSelected, esp]
                                    )}
                                    className={`text-[11px] px-3 py-1.5 rounded-xl font-semibold border transition-all ${
                                      checked
                                        ? "bg-brand text-white border-brand shadow-sm shadow-brand/20"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-brand/50 hover:text-brand"
                                    }`}
                                  >
                                    {esp}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-[11px] font-bold text-slate-400">
                            {espSelected.length} selecionada{espSelected.length !== 1 ? "s" : ""}
                          </p>
                          {espSelected.length > 0 && (
                            <button 
                              type="button" 
                              onClick={() => setEspSelected([])}
                              className="text-[10px] font-bold text-red-500 hover:underline"
                            >
                              Limpar tudo
                            </button>
                          )}
                        </div>
                        <Button onClick={handleSaveEsp} disabled={savingEsp} size="lg" className="w-full bg-brand text-white rounded-2xl h-12 font-bold shadow-lg shadow-brand/20">
                          {savingEsp ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar especialidades"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selected.especialidades.length > 0
                        ? selected.especialidades.map((e: string) => (
                          <span key={e} className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">{e}</span>
                        ))
                        : <p className="text-sm text-slate-400">Nenhuma especialidade cadastrada</p>
                      }
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                  {selected.slug && (
                    <Button asChild variant="outline" size="sm" className="w-full rounded-xl justify-start gap-2">
                      <Link to="/profissionais/perfil/$slug" params={{ slug: selected.slug }}>
                        <ArrowUpRight className="h-4 w-4" /> Ver perfil público
                      </Link>
                    </Button>
                  )}
                  {selected.whatsapp && (
                    <Button asChild variant="outline" size="sm" className="w-full rounded-xl justify-start gap-2 text-green-600 border-green-200 hover:bg-green-50">
                      <a href={`https://wa.me/${selected.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                        <Mail className="h-4 w-4" /> Contato via WhatsApp
                      </a>
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDeletePro(selected.id)}
                    disabled={isDeleting}
                    className="w-full rounded-xl justify-start gap-2 text-red-500 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100"
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Excluir Profissional
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Novo Profissional</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreatePro} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome Completo</label>
                  <input
                    required
                    value={newPro.nome}
                    onChange={e => setNewPro({ ...newPro, nome: e.target.value })}
                    placeholder="Ex: João da Silva"
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand/20 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail</label>
                  <input
                    required
                    type="email"
                    value={newPro.email}
                    onChange={e => setNewPro({ ...newPro, email: e.target.value })}
                    placeholder="joao@exemplo.com"
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand/20 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Senha Provisória</label>
                  <input
                    required
                    type="password"
                    value={newPro.password}
                    onChange={e => setNewPro({ ...newPro, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand/20 outline-none"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isCreating} 
                  className="w-full bg-brand text-white rounded-2xl h-12 font-bold shadow-lg shadow-brand/20 mt-4"
                >
                  {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : "Criar Conta"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== CLIENTES ============== */


function AdminClientes() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/admin" }) as any;
  const q = searchParams.cli_q || "";
  const setQ = (val: string) => navigate({ search: (old: any) => ({ ...old, cli_q: val || undefined }) });

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["admin", "clientes"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const proIds = new Set((roles || []).filter((r: any) => r.role !== "cliente").map((r: any) => r.user_id));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome, email, whatsapp, total_servicos_pagos, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      return (profs || []).filter((p: any) => !proIds.has(p.id));
    }
  });

  const filtered = clientes.filter(
    (c) =>
      !q ||
      c.nome?.toLowerCase().includes(q.toLowerCase()) ||
      c.email?.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-bold">Lista de Clientes ({clientes.length})</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar..."
            className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-brand/20 outline-none"
          />
        </div>
      </div>
      
      {isLoading && (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <div className="space-y-1 text-right">
                <Skeleton className="h-4 w-20 ml-auto" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && <p className="text-sm text-slate-400">Nenhum cliente encontrado.</p>}
      
      <div className="space-y-4">
        {!isLoading && filtered.map((c) => (
          <div key={c.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-10 w-10 rounded-full bg-brand-soft text-brand flex items-center justify-center font-bold text-sm shrink-0">
                {c.nome?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm truncate">{c.nome || "Sem nome"}</h4>
                <p className="text-xs text-slate-500 truncate">{c.email} {c.whatsapp ? `· ${c.whatsapp}` : ""}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold">{c.total_servicos_pagos} pedidos pagos</p>
              <p className="text-[10px] text-slate-400 italic">Desde {new Date(c.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============== SERVIÇOS ============== */

function AdminServicos() {
  const { data: servicos = [], isLoading } = useQuery({
    queryKey: ["admin", "servicos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services_catalog")
        .select("*")
        .order("categoria")
        .order("nome");
      return data || [];
    }
  });

  const categorias = useMemo(() => {
    const map: Record<string, number> = {};
    servicos.forEach((s: any) => { map[s.categoria] = (map[s.categoria] || 0) + 1; });
    return Object.entries(map);
  }, [servicos]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Catálogo de Serviços</h2>
        <div className="flex gap-2">
          <Link to="/materiais-admin"><Button variant="outline" className="rounded-lg">Materiais</Button></Link>
          <Link to="/servicos-admin"><Button className="bg-brand text-white rounded-lg">Gerenciar serviços</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading && [...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
        {!isLoading && categorias.map(([cat, count]) => (
          <div key={cat} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="font-bold capitalize">{cat}</p>
            <p className="text-xs text-slate-500">{count} {count === 1 ? "item ativo" : "itens ativos"}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
            <tr>
              <th className="px-6 py-4">Serviço</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4">Faixa de preço</th>
              <th className="px-6 py-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && [...Array(5)].map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4"><Skeleton className="h-4 w-48" /></td>
                <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                <td className="px-6 py-4 text-right"><Skeleton className="h-5 w-16 ml-auto rounded-full" /></td>
              </tr>
            ))}
            {!isLoading && servicos.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">Nenhum serviço cadastrado.</td></tr>
            )}
            {!isLoading && servicos.map((s: any) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-bold">{s.nome}</td>
                <td className="px-6 py-4 text-sm text-slate-600 capitalize">{s.categoria}</td>
                <td className="px-6 py-4 text-sm font-bold">
                  {s.preco_min != null && s.preco_max != null
                    ? `R$ ${Number(s.preco_min).toFixed(0)} – R$ ${Number(s.preco_max).toFixed(0)}`
                    : s.preco_fixo != null
                      ? `R$ ${Number(s.preco_fixo).toFixed(2)}`
                      : "—"}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${s.ativo ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-400"}`}>
                    {s.ativo ? "Ativo" : "Inativo"}
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

/* ============== FINANCEIRO ============== */

function AdminFinanceiro() {
  const [data, setData] = useState<{ bruto: number; liquido: number; pendente: number; pagos: any[] } | null>(null);
  const [comissao] = useState(20);

  useEffect(() => {
    (async () => {
      const { data: orcs } = await supabase
        .from("orcamentos")
        .select("id, status, valor, service_name, created_at, data_pagamento, cliente_id, profissional_id")
        .in("status", ["pago", "aprovado", "enviado"])
        .order("created_at", { ascending: false })
        .limit(100);
      const list = orcs || [];
      const pagos = list.filter((o: any) => o.status === "pago");
      const bruto = pagos.reduce((s: number, o: any) => s + Number(o.valor || 0), 0);
      const liquido = bruto * (comissao / 100);
      const pendente = list
        .filter((o: any) => ["aprovado", "enviado"].includes(o.status))
        .reduce((s: number, o: any) => s + Number(o.valor || 0), 0);
      setData({ bruto, liquido, pendente, pagos });
    })();
  }, [comissao]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Relatório Financeiro</h2>
      </div>

      {!data && <p className="text-sm text-slate-400">Carregando…</p>}

      {data && (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Volume Bruto (pagos)</p>
              <h3 className="text-3xl font-bold">R$ {data.bruto.toFixed(2)}</h3>
              <div className="mt-4 flex items-center gap-1 text-emerald-600 text-xs font-bold">
                <ArrowUpRight className="h-3 w-3" /> {data.pagos.length} {data.pagos.length === 1 ? "pagamento" : "pagamentos"}
              </div>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Líquido Plataforma</p>
              <h3 className="text-3xl font-bold">R$ {data.liquido.toFixed(2)}</h3>
              <div className="mt-4 flex items-center gap-1 text-slate-500 text-xs font-bold">
                Comissão: {comissao}%
              </div>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Aguardando Pagamento</p>
              <h3 className="text-3xl font-bold">R$ {data.pendente.toFixed(2)}</h3>
              <div className="mt-4 flex items-center gap-1 text-amber-600 text-xs font-bold">
                <Clock className="h-3 w-3" /> Aprovados/enviados
              </div>
            </div>
          </div>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-6 border-b border-slate-100 font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" /> Últimos pagamentos recebidos
            </div>
            <div className="p-6 space-y-4">
              {data.pagos.length === 0 && <p className="text-sm text-slate-400">Nenhum pagamento ainda.</p>}
              {data.pagos.slice(0, 10).map((f: any) => (
                <div key={f.id} className="flex justify-between items-center border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-bold">{f.service_name}</p>
                    <p className="text-xs text-slate-400">
                      #{f.id.slice(0, 8)} · {f.data_pagamento ? new Date(f.data_pagamento).toLocaleDateString("pt-BR") : "—"}
                    </p>
                  </div>
                  <p className="font-bold text-emerald-600">+ R$ {Number(f.valor || 0).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* ============== CONFIG ============== */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const configSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
});

type ConfigValues = z.infer<typeof configSchema>;

function AdminConfig() {
  const { profile, user, adminLevel } = useAuth();
  const navigate = useNavigate();
  const [simulando, setSimulando] = useState(false);

  const trocarSenha = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) toast.error("Erro", { description: error.message });
    else toast.success("E-mail de redefinição enviado", { description: user.email });
  };

  const levelMeta = adminLevel ? ADMIN_LEVEL_LABELS[adminLevel] : null;
  const initials = (profile?.nome || user?.email || "AD")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="max-w-2xl space-y-6 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold">Configurações da conta</h2>

      {/* Profile card */}
      <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-slate-800 text-white flex items-center justify-center text-xl font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold truncate">{profile?.nome || "—"}</p>
            <p className="text-sm text-slate-500 truncate">{user?.email}</p>
            {profile?.whatsapp && <p className="text-sm text-slate-500">{profile.whatsapp}</p>}
            {levelMeta && (
              <span className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${levelMeta.color}`}>
                <levelMeta.icon className="h-3 w-3" />
                {levelMeta.label}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            className="rounded-xl font-bold shrink-0 flex items-center gap-2"
            onClick={() => navigate({ to: "/cliente", search: { tab: "dados" } as any })}
          >
            <ArrowUpRight className="h-4 w-4" />
            Editar perfil
          </Button>
        </div>
        <p className="mt-6 text-xs text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Para editar nome, WhatsApp e foto, acesse a área do cliente — os dados são compartilhados entre os dois painéis.
        </p>
      </section>

      {/* Security */}
      <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold mb-2 text-slate-900">Segurança</h3>
        <p className="text-sm text-slate-500 mb-4">Enviaremos um link para <strong>{user?.email}</strong> para você definir uma nova senha.</p>
        <Button variant="outline" className="rounded-lg" onClick={trocarSenha}>Enviar link de redefinição de senha</Button>
      </section>

      {/* Simulator */}
      <section className="bg-amber-50 p-8 rounded-2xl border border-amber-200 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
              <Database className="h-5 w-5" /> Simulador de Plataforma
            </h3>
            <p className="text-sm text-amber-800/80 mb-6 max-w-lg">
              Clique para gerar clientes, profissionais e dezenas de pedidos falsos (orçamentos pendentes, pagos, recusados) para visualizar como os painéis (Admin e Profissional) se comportam com dados reais. Use emails de teste criados para testar o login deles.
            </p>
            <Button
              onClick={async () => {
                setSimulando(true);
                try {
                  const tempClient = createClient(
                    import.meta.env.VITE_SUPABASE_URL,
                    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                    { auth: { persistSession: false, autoRefreshToken: false } }
                  );
                  const signUpAndGetId = async (email: string, nome: string) => {
                    const { data, error } = await tempClient.auth.signUp({
                      email,
                      password: "Simulador@2026!",
                      options: { data: { nome } }
                    });
                    if (error) throw error;
                    return data.user?.id;
                  };
                  
                  const s = Math.floor(Math.random() * 10000);
                  toast.loading("Criando usuários falsos...", { id: "sim" });
                  
                  const c1 = await signUpAndGetId(`cliente${s}@teste.com`, `Cliente Teste ${s}`);
                  const p1 = await signUpAndGetId(`joao${s}@eletrica.com`, `João Eletricista ${s}`);
                  const p2 = await signUpAndGetId(`maria${s}@hidraulica.com`, `Maria Encanadora ${s}`);
                  
                  if (!c1 || !p1 || !p2) throw new Error("Falha ao gerar IDs");

                  await new Promise(r => setTimeout(r, 1500)); // wait for profile triggers

                  toast.loading("Atribuindo perfis profissionais...", { id: "sim" });
                  await supabase.from("user_roles").insert([
                    { user_id: p1, role: "profissional" },
                    { user_id: p2, role: "profissional" }
                  ]);
                  await supabase.from("profissional_perfil").insert([
                    { user_id: p1, ativo: true },
                    { user_id: p2, ativo: true }
                  ]);

                  toast.loading("Criando dezenas de pedidos e métricas...", { id: "sim" });
                  const orcs = [
                    { cliente_id: c1, profissional_id: p1, service_name: "Troca de Chuveiro", status: "pago" as const, valor: 180, valor_servico: 180, created_at: new Date(Date.now() - 86400000*2).toISOString(), data_pagamento: new Date().toISOString() },
                    { cliente_id: c1, profissional_id: p2, service_name: "Vazamento na Pia", status: "aprovado" as const, valor: 120, valor_servico: 120, created_at: new Date(Date.now() - 86400000).toISOString() },
                    { cliente_id: c1, service_name: "Instalação de Tomadas", status: "customizado_pendente" as const, created_at: new Date().toISOString() },
                    { cliente_id: c1, profissional_id: p1, service_name: "Pintura Parede", status: "recusado" as const, created_at: new Date(Date.now() - 86400000*5).toISOString() },
                    { cliente_id: c1, profissional_id: p2, service_name: "Desentupimento", status: "pago" as const, valor: 300, valor_servico: 300, created_at: new Date(Date.now() - 86400000*10).toISOString(), data_pagamento: new Date(Date.now() - 86400000*8).toISOString() }
                  ];
                  await supabase.from("orcamentos").insert(orcs);

                  // Create some ratings
                  const { data: insertedOrcs } = await supabase.from("orcamentos").select("id, profissional_id").eq("cliente_id", c1).eq("status", "pago");
                  if (insertedOrcs) {
                    const avs = insertedOrcs.map(o => ({
                      orcamento_id: o.id,
                      cliente_id: c1,
                      profissional_id: o.profissional_id,
                      nota: 5,
                      comentario: "Excelente profissional!"
                    }));
                    if (avs.length) await supabase.from("avaliacoes").insert(avs);
                  }

                  toast.success(`Simulador concluído! Logins de teste criados com senha: Simulador@2026!\ncliente${s}@teste.com`, { id: "sim" });
                } catch (err: any) {
                  toast.error("Erro na simulação", { id: "sim", description: err?.message });
                } finally {
                  setSimulando(false);
                }
              }}
              disabled={simulando}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl"
            >
              {simulando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {simulando ? "Injetando dados no banco..." : "Gerar Dados de Teste"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

// remove unused import warnings stubs
void ChevronRight;
void Trash2;

/* ============== EQUIPE ADMIN ============== */

function AdminEquipe() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLevel, setInviteLevel] = useState<NonNullable<AdminLevel>>("suporte");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [changingLevel, setChangingLevel] = useState<string | null>(null);

  const { data: team = [], isLoading } = useQuery({
    queryKey: ["admin", "equipe"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, admin_level")
        .eq("role", "admin");
      if (!roles?.length) return [];
      const ids = roles.map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", ids);
      return (profiles || []).map((p: any) => ({
        ...p,
        admin_level: roles.find((r: any) => r.user_id === p.id)?.admin_level ?? null,
      }));
    },
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      // 1. Look up user by email in profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", inviteEmail.trim())
        .maybeSingle();

      if (!profile) {
        toast.error("Usuário não encontrado", { description: "O e-mail precisa ter uma conta no sistema." });
        return;
      }

      // 2. Check if already admin
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", profile.id)
        .eq("role", "admin")
        .maybeSingle();

      if (existing) {
        toast.error("Este usuário já é administrador.");
        return;
      }

      // 3. Upsert role
      const { error } = await supabase.from("user_roles").insert({
        user_id: profile.id,
        role: "admin",
        admin_level: inviteLevel,
      });

      if (error) throw error;
      toast.success("Administrador adicionado!", { description: `${inviteEmail} agora é ${ADMIN_LEVEL_LABELS[inviteLevel].label}.` });
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["admin", "equipe"] });
    } catch (e: any) {
      toast.error("Erro ao convidar", { description: e.message });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string, memberEmail: string) => {
    if (memberId === user?.id) { toast.error("Você não pode remover a si mesmo."); return; }
    if (!confirm(`Remover acesso de admin de ${memberEmail}?`)) return;
    setRemoving(memberId);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", memberId)
      .eq("role", "admin");
    setRemoving(null);
    if (error) { toast.error("Erro ao remover", { description: error.message }); return; }
    toast.success("Acesso removido.");
    qc.invalidateQueries({ queryKey: ["admin", "equipe"] });
  };

  const handleChangeLevel = async (memberId: string, newLevel: NonNullable<AdminLevel>) => {
    setChangingLevel(memberId);
    const { error } = await supabase
      .from("user_roles")
      .update({ admin_level: newLevel })
      .eq("user_id", memberId)
      .eq("role", "admin");
    setChangingLevel(null);
    if (error) { toast.error("Erro ao atualizar nível", { description: error.message }); return; }
    toast.success("Nível atualizado com sucesso.");
    qc.invalidateQueries({ queryKey: ["admin", "equipe"] });
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold">Equipe Administrativa</h2>
        <p className="text-sm text-slate-500 mt-1">Gerencie quem tem acesso ao painel e com quais permissões.</p>
      </div>

      {/* Permission levels legend */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.entries(ADMIN_LEVEL_LABELS) as [NonNullable<AdminLevel>, typeof ADMIN_LEVEL_LABELS[keyof typeof ADMIN_LEVEL_LABELS]][]).map(([level, meta]) => (
          <div key={level} className={`p-4 rounded-xl border flex items-start gap-3 ${meta.color.replace("text-", "border-").split(" ")[0]}/20 bg-white`}>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
              <meta.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-sm">{meta.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {level === "super_admin" && "Acesso total ao painel"}
                {level === "admin" && "Gestão operacional"}
                {level === "financeiro" && "Dashboard e financeiro"}
                {level === "suporte" && "Pedidos e clientes (leitura)"}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Invite new admin */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <h3 className="font-bold mb-1 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-brand" /> Adicionar Administrador
        </h3>
        <p className="text-sm text-slate-500 mb-6">O usuário já precisa ter uma conta no sistema.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="flex-1 p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-brand/20 outline-none"
          />
          <select
            value={inviteLevel}
            onChange={(e) => setInviteLevel(e.target.value as NonNullable<AdminLevel>)}
            className="p-3 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-brand/20 outline-none"
          >
            <option value="suporte">Suporte</option>
            <option value="financeiro">Financeiro</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <Button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="bg-brand text-white rounded-lg px-6 font-bold"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
          </Button>
        </div>
      </section>

      {/* Team list */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold">{team.length} administradores</h3>
          <Lock className="h-4 w-4 text-slate-400" />
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading && (
            [...Array(3)].map((_, i) => (
              <div key={i} className="px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            ))
          )}
          {!isLoading && team.map((member: any) => {
            const meta = member.admin_level ? ADMIN_LEVEL_LABELS[member.admin_level as NonNullable<AdminLevel>] : null;
            const isSelf = member.id === user?.id;
            return (
              <div key={member.id} className={`px-8 py-5 flex items-center justify-between gap-4 ${isSelf ? "bg-brand/5" : "hover:bg-slate-50"} transition-colors`}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {(member.nome || member.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm truncate">{member.nome || member.email}</p>
                      {isSelf && <span className="text-[9px] font-bold uppercase text-brand bg-brand/10 px-1.5 py-0.5 rounded">Você</span>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{member.email}</p>
                    {meta && (
                      <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${meta.color}`}>
                        <meta.icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={member.admin_level ?? ""}
                    disabled={changingLevel === member.id}
                    onChange={(e) => handleChangeLevel(member.id, e.target.value as NonNullable<AdminLevel>)}
                    className="text-xs p-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-brand/20 outline-none"
                  >
                    <option value="suporte">Suporte</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={removing === member.id || isSelf}
                    onClick={() => handleRemove(member.id, member.email)}
                    className={`rounded-lg px-3 ${isSelf ? "text-slate-300 cursor-not-allowed" : "text-red-500 hover:bg-red-50 hover:text-red-600"}`}
                    title={isSelf ? "Você não pode remover a si mesmo" : "Remover acesso"}
                  >
                    {removing === member.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>

              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
