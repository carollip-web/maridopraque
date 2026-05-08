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
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AdminMetrics } from "@/components/AdminMetrics";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminArea,
  head: () => ({ meta: [{ title: "Admin · Marido pra Quê?" }] }),
});

type AdminTab = "dashboard" | "pedidos" | "profissionais" | "servicos" | "clientes" | "financeiro" | "config";

function AdminArea() {
  const { isLoggedIn, isAdmin, loading, profile, user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn) {
      navigate({ to: "/login" });
    } else if (!isAdmin) {
      toast.error("Acesso restrito a administradores.");
      navigate({ to: "/cliente" });
    }
  }, [loading, isLoggedIn, isAdmin, navigate]);

  if (loading || !isLoggedIn || !isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "pedidos", label: "Gestão de Pedidos", icon: ShoppingBag },
    { id: "profissionais", label: "Profissionais", icon: Wrench },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "servicos", label: "Serviços", icon: FileText },
    { id: "financeiro", label: "Financeiro", icon: DollarSign },
    { id: "config", label: "Configurações", icon: Settings },
  ];

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

        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">{initials}</div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate">{profile?.nome || "Administrador"}</p>
              <p className="text-[10px] text-slate-500 truncate">{adminEmail}</p>
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
            <Link to="/cliente" className="text-xs font-bold text-slate-500 hover:text-brand">
              Ver app como cliente
            </Link>
            <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Bell className="h-5 w-5 text-slate-600" />
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full">
          {activeTab === "dashboard" && <AdminMetrics />}
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

/* ============== PEDIDOS ============== */

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  customizado_pendente: { bg: "bg-amber-50", color: "text-amber-700", label: "Pendente" },
  enviado: { bg: "bg-sky-50", color: "text-sky-700", label: "Enviado" },
  aprovado: { bg: "bg-blue-50", color: "text-blue-700", label: "Aprovado" },
  pago: { bg: "bg-emerald-50", color: "text-emerald-700", label: "Pago" },
  recusado: { bg: "bg-red-50", color: "text-red-700", label: "Recusado" },
  cancelado: { bg: "bg-slate-100", color: "text-slate-600", label: "Cancelado" },
  fixo_auto: { bg: "bg-violet-50", color: "text-violet-700", label: "Auto-aprovado" },
};

function AdminPedidos() {
  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("todos");

  const reload = async () => {
    setLoading(true);
    const { data: orcs } = await supabase
      .from("orcamentos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = orcs || [];
    const ids = Array.from(new Set(list.flatMap((o: any) => [o.cliente_id, o.profissional_id]).filter(Boolean)));
    let map: Record<string, any> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, nome, email").in("id", ids);
      map = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
    }
    setOrcamentos(list);
    setProfiles(map);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    return orcamentos.filter((o) => {
      if (filter !== "todos" && o.status !== filter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      const cliente = profiles[o.cliente_id]?.nome?.toLowerCase() || "";
      return (
        o.id.toLowerCase().includes(q) ||
        o.service_name?.toLowerCase().includes(q) ||
        cliente.includes(q)
      );
    });
  }, [orcamentos, filter, search, profiles]);

  const tabs = [
    { id: "todos", label: "Todos" },
    { id: "customizado_pendente", label: "Pendentes" },
    { id: "enviado", label: "Enviados" },
    { id: "aprovado", label: "Aprovados" },
    { id: "pago", label: "Pagos" },
    { id: "cancelado", label: "Cancelados" },
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
          <Button variant="outline" className="rounded-lg gap-2" onClick={reload}>
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
              {loading && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">Carregando…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">Nenhum pedido encontrado.</td></tr>
              )}
              {!loading && filtered.map((o) => {
                const meta = STATUS_COLORS[o.status] ?? { bg: "bg-slate-100", color: "text-slate-600", label: o.status };
                const cli = profiles[o.cliente_id];
                const prof = o.profissional_id ? profiles[o.profissional_id] : null;
                return (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">#{o.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-sm font-bold">{cli?.nome || "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{o.service_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{prof?.nome || "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${meta.bg} ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">R$ {Number(o.valor || 0).toFixed(2)}</td>
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

function AdminProfissionais() {
  const [pros, setPros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "profissional");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) { setPros([]); setLoading(false); return; }

      const [{ data: profs }, { data: perfis }, { data: orcs }, { data: avs }] = await Promise.all([
        supabase.from("profiles").select("id, nome, email").in("id", ids),
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

      const list = (profs || []).map((p: any) => {
        const s = stats[p.id] || { ganhos: 0, servicos: 0, nota: 0, n: 0 };
        const perfil = perfilMap[p.id];
        return {
          id: p.id,
          nome: p.nome || p.email,
          email: p.email,
          ativo: perfil?.ativo ?? true,
          especialidades: perfil?.especialidades || [],
          ganhos: s.ganhos,
          servicos: s.servicos,
          rating: s.n > 0 ? (s.nota / s.n) : null,
        };
      });
      setPros(list);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Profissionais cadastrados</h2>
        <p className="text-sm text-slate-500">{pros.length} no total</p>
      </div>

      {loading && <p className="text-sm text-slate-400">Carregando…</p>}
      {!loading && pros.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          Nenhum profissional cadastrado ainda.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {pros.map((pro) => (
          <div key={pro.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-full bg-brand-soft text-brand flex items-center justify-center font-bold">
                {pro.nome?.[0]?.toUpperCase() || "?"}
              </div>
              <div className={`h-2 w-2 rounded-full ${pro.ativo ? "bg-green-500" : "bg-slate-300"}`} />
            </div>
            <h3 className="font-bold text-slate-900 truncate">{pro.nome}</h3>
            <p className="text-xs text-slate-500 truncate inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {pro.email}</p>
            {pro.especialidades.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {pro.especialidades.slice(0, 3).map((e: string) => (
                  <span key={e} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{e}</span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Ganhos</p>
                <p className="text-sm font-bold">R$ {pro.ganhos.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Serviços</p>
                <p className="text-sm font-bold">{pro.servicos}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Nota</p>
                <p className="text-sm font-bold inline-flex items-center gap-0.5">
                  {pro.rating != null ? <>{pro.rating.toFixed(1)} <Star className="h-3 w-3 text-amber-500" fill="currentColor" /></> : "—"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============== CLIENTES ============== */

function AdminClientes() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const proIds = new Set((roles || []).filter((r: any) => r.role !== "cliente").map((r: any) => r.user_id));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome, email, whatsapp, total_servicos_pagos, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      setClientes((profs || []).filter((p: any) => !proIds.has(p.id)));
      setLoading(false);
    })();
  }, []);

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
      {loading && <p className="text-sm text-slate-400">Carregando…</p>}
      {!loading && filtered.length === 0 && <p className="text-sm text-slate-400">Nenhum cliente encontrado.</p>}
      <div className="space-y-4">
        {filtered.map((c) => (
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
  const [servicos, setServicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("services_catalog")
        .select("*")
        .order("categoria")
        .order("nome");
      setServicos(data || []);
      setLoading(false);
    })();
  }, []);

  const categorias = useMemo(() => {
    const map: Record<string, number> = {};
    servicos.forEach((s) => { map[s.categoria] = (map[s.categoria] || 0) + 1; });
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
        {categorias.map(([cat, count]) => (
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
            {loading && <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">Carregando…</td></tr>}
            {!loading && servicos.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">Nenhum serviço cadastrado.</td></tr>
            )}
            {servicos.map((s) => (
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

function AdminConfig() {
  const { profile, user } = useAuth();
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || "");
  const [nome, setNome] = useState(profile?.nome || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWhatsapp(profile?.whatsapp || "");
    setNome(profile?.nome || "");
  }, [profile]);

  const salvar = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome, whatsapp })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else toast.success("Perfil atualizado");
  };

  const trocarSenha = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) toast.error("Erro", { description: error.message });
    else toast.success("E-mail de redefinição enviado", { description: user.email });
  };

  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold">Configurações da conta</h2>

      <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold mb-6 text-slate-900 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" /> Perfil do administrador</h3>
        <div className="space-y-4">
          <div className="grid gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-brand outline-none"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">E-mail</label>
            <input
              value={user?.email || ""}
              disabled
              className="p-3 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-500"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">WhatsApp</label>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+55 (21) 99999-9999"
              className="p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-brand outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={salvar} disabled={saving} className="bg-brand text-white rounded-lg">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alterações"}
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold mb-2 text-slate-900">Segurança</h3>
        <p className="text-sm text-slate-500 mb-4">Enviaremos um link para o seu e-mail para você definir uma nova senha.</p>
        <Button variant="outline" className="rounded-lg" onClick={trocarSenha}>Enviar link de redefinição de senha</Button>
      </section>

      <section className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          Configurações globais (comissão da plataforma, e-mail de notificações) ainda não têm tabela dedicada. Posso criar uma tabela <code>app_settings</code> para persistir esses valores se quiser.
        </div>
      </section>
    </div>
  );
}

// remove unused import warnings stubs
void ChevronRight;
void Trash2;
