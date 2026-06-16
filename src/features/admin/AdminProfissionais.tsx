import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useSearch, Link } from "@tanstack/react-router";
import {
  Wrench,
  Settings,
  ShieldCheck,
  Search,
  UserPlus,
  Star,
  X,
  Loader2,
  Mail,
  ArrowUpRight,
  Trash2,
  Users,
} from "lucide-react";
import { type Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { criarUsuarioAdmin, excluirUsuarioAdmin } from "@/lib/usuarios.functions";
import { AdminLeads } from "./AdminLeads";
import { AdminApoioFeminino } from "./AdminApoioFeminino";

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
    },
  });

  if (isLoading)
    return (
      <div className="mt-4 p-4 bg-white/5 rounded-xl animate-pulse text-white/50 text-xs">
        Carregando detalhes...
      </div>
    );

  return (
    <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10 space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
      {details?.length === 0 && (
        <p className="text-xs text-white/40 text-center py-4">Nenhum registro encontrado.</p>
      )}

      {view === "nota"
        ? (details as unknown as Tables<"avaliacoes">[]).map((av) => (
            <div key={av.id} className="text-left border-b border-white/5 pb-2 last:border-0">
              <div className="flex justify-between items-center mb-1">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-2.5 w-2.5 ${i < av.nota ? "fill-amber-400 text-amber-400" : "text-white/20"}`}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-white/30">
                  {new Date(av.created_at).toLocaleDateString()}
                </span>
              </div>
              {av.comentario && (
                <p className="text-xs text-white/70 italic line-clamp-2">"{av.comentario}"</p>
              )}
            </div>
          ))
        : (details as unknown as Tables<"orcamentos">[]).map((orc) => (
            <div
              key={orc.id}
              className="flex justify-between items-center text-left border-b border-white/5 pb-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold truncate text-white/90">
                  {orc.service_name || "Serviço sem nome"}
                </p>
                <p className="text-[10px] text-white/40">
                  {new Date(orc.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-xs font-bold text-white">R$ {orc.valor || 0}</p>
                <span
                  className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    orc.status === "pago"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {orc.status}
                </span>
              </div>
            </div>
          ))}
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
  {
    categoria: "Apoio e Segurança",
    icon: Users,
    opcoes: ["Apoio Feminino"],
  },
];

export function AdminProfissionais() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const criarUsuarioFn = useServerFn(criarUsuarioAdmin);
  const excluirUsuarioFn = useServerFn(excluirUsuarioAdmin);
  const searchParams = (useSearch({ strict: false }) || {}) as Record<string, unknown>;
  const search = (searchParams.pro_q as string | undefined) || "";
  const filterStatus = (searchParams.pro_status as string | undefined) || "todos";

  const setSearch = (val: string) =>
    navigate({
      search: ((old: Record<string, unknown>) => ({ ...old, pro_q: val || undefined })) as never,
    });
  const setFilterStatus = (val: string) =>
    navigate({
      search: ((old: Record<string, unknown>) => ({ ...old, pro_status: val || "todos" })) as never,
    });
  const clearFilters = () => navigate({ search: ((old: Record<string, unknown>) => ({ tab: old.tab })) as never });

  const [selected, setSelected] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"lista" | "leads" | "apoio">("lista");
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
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "profissional");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];

      const [{ data: profs }, { data: perfis }, { data: orcs }, { data: avs }] = await Promise.all([
        supabase.from("profiles").select("id, nome, email, whatsapp").in("id", ids),
        supabase.from("profissional_perfil").select("*").in("user_id", ids),
        supabase
          .from("orcamentos")
          .select("profissional_id, status, valor")
          .in("profissional_id", ids),
        supabase.from("avaliacoes").select("profissional_id, nota").in("profissional_id", ids),
      ]);

      const perfilMap = Object.fromEntries((perfis || []).map((p: any) => [p.user_id, p]));
      const stats: Record<string, { ganhos: number; servicos: number; nota: number; n: number }> =
        {};
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
          aprovacao_status: perfil?.aprovacao_status || "pendente",
          ganhos: s.ganhos,
          servicos: s.servicos,
          rating: s.n > 0 ? s.nota / s.n : null,
          avaliacoes: s.n,
          genero: perfil?.genero || "nao_informar",
          oferece_apoio_feminino: !!perfil?.oferece_apoio_feminino,
        };
      });
    },
  });

  const approvedPros = pros.filter((p) => p.aprovacao_status === "aprovado");

  const filtered = approvedPros.filter((p) => {
    const matchSearch =
      !search ||
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
    const { error } = await supabase.from("profissional_perfil").upsert({
      user_id: pro.id,
      ativo: !pro.ativo,
      updated_at: new Date().toISOString(),
    });
    setTogglingId(null);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success(pro.ativo ? "Profissional desativado" : "Profissional ativado");
    qc.invalidateQueries({ queryKey: ["admin", "profissionais"] });
    if (selected?.id === pro.id) setSelected({ ...selected, ativo: !pro.ativo });
  };

  const handleSaveEsp = async () => {
    if (!selected) return;
    setSavingEsp(true);
    const { error } = await supabase.from("profissional_perfil").upsert({
      user_id: selected.id,
      especialidades: espSelected,
      updated_at: new Date().toISOString(),
    });
    setSavingEsp(false);
    if (error) {
      toast.error("Erro ao salvar especialidades");
      return;
    }
    toast.success("Especialidades atualizadas");
    setEditingEsp(false);
    qc.invalidateQueries({ queryKey: ["admin", "profissionais"] });
    setSelected({ ...selected, especialidades: espSelected });
  };

  const handleCreatePro = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const { ok } = await criarUsuarioFn({
        data: { ...newPro, role: "profissional" },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!ok) throw new Error("Erro ao criar profissional");

      toast.success("Profissional criado com sucesso!");
      setShowAddModal(false);
      setNewPro({ nome: "", email: "", password: "" });
      qc.invalidateQueries({ queryKey: ["admin", "profissionais"] });
    } catch (e: any) {
      toast.error("Erro ao criar", { description: e.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePro = async (id: string) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir este profissional? Esta ação é irreversível e removerá todos os dados do usuário.",
      )
    )
      return;
    setIsDeleting(true);
    try {
      const { ok } = await excluirUsuarioFn({
        data: { targetUserId: id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!ok) throw new Error("Erro ao excluir profissional");

      toast.success("Profissional excluído!");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin", "profissionais"] });
    } catch (e: any) {
      toast.error("Erro ao excluir", { description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Profissionais</h2>
          <p className="text-sm text-slate-500">
            {approvedPros.length} cadastrados · {approvedPros.filter((p) => p.ativo).length} ativos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors shrink-0"
          >
            <UserPlus className="h-4 w-4" /> Novo Profissional
          </button>
          <a
            href="/admin-validacao"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-colors shrink-0"
          >
            🛡️ Validação
          </a>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        {[
          { id: "lista", label: "Lista de Profissionais" },
          { id: "leads", label: "Leads (Pré-Cadastro)" },
          { id: "apoio", label: "Apoio Feminino" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "leads" | "apoio" | "lista")}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "leads" && <AdminLeads />}
      {activeTab === "apoio" && <AdminApoioFeminino />}

      {activeTab === "lista" && (
        <>
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
        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-400 font-medium mr-1 hidden sm:inline">Status:</span>
          {[
            { id: "todos", label: `Todos (${approvedPros.length})` },
            {
              id: "ativo",
              label: `Ativos (${approvedPros.filter((p) => p.ativo).length})`,
            },
            {
              id: "inativo",
              label: `Inativos (${approvedPros.filter((p) => !p.ativo).length})`,
            },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setFilterStatus(s.id)}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-slate-500 hover:text-red-500 gap-1 px-2"
            >
              <X className="h-4 w-4" /> Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        <div className={`flex-1 min-w-0 ${selected ? "hidden lg:block" : ""}`}>
          {isLoading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4"
                >
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
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <p className="font-medium text-slate-600 mb-1">
                {filterStatus === "inativo"
                  ? "Nenhum profissional inativo"
                  : filterStatus === "ativo"
                  ? "Nenhum profissional ativo"
                  : search
                  ? "Nenhum resultado para esta busca"
                  : "Nenhum profissional cadastrado"}
              </p>
              {(search || filterStatus !== "todos") && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                  Remover filtros
                </Button>
              )}
            </div>
          )}
          {!isLoading && (
            <div className="space-y-3">
              {filtered.map((pro) => (
                <button
                  key={pro.id}
                  onClick={() => {
                    setSelected(pro);
                    setEditingEsp(false);
                    setDetailView(null);
                    setEspSelected([...pro.especialidades]);
                  }}
                  className={`w-full bg-white rounded-2xl border text-left p-5 flex items-center gap-4 transition-all hover:shadow-md ${
                    selected?.id === pro.id
                      ? "border-brand ring-2 ring-brand/20"
                      : "border-slate-200"
                  }`}
                >
                  <div
                    className={`h-11 w-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${pro.ativo ? "bg-brand-soft text-brand" : "bg-slate-100 text-slate-400"}`}
                  >
                    {pro.nome?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm truncate">{pro.nome}</p>
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${pro.ativo ? "bg-green-500" : "bg-slate-300"}`}
                      />
                    </div>
                    <p className="text-xs text-slate-500 truncate">{pro.email}</p>
                    {pro.especialidades.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {pro.especialidades.slice(0, 3).map((e: string) => (
                          <span
                            key={e}
                            className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium"
                          >
                            {e}
                          </span>
                        ))}
                        {pro.especialidades.length > 3 && (
                          <span className="text-[9px] text-slate-400">
                            +{pro.especialidades.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right hidden sm:block">
                    {pro.rating != null && (
                      <p className="text-sm font-bold flex items-center gap-0.5 text-amber-500">
                        {pro.rating.toFixed(1)} <Star className="h-3 w-3" fill="currentColor" />
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">
                      {pro.servicos} serviço{pro.servicos !== 1 ? "s" : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="w-full lg:w-96 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm sticky top-20 overflow-hidden">
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
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-5">
                  {[
                    {
                      key: "ganhos" as const,
                      label: "Ganhos",
                      value: `R$ ${selected.ganhos.toFixed(0)}`,
                    },
                    {
                      key: "servicos" as const,
                      label: "Serviços",
                      value: String(selected.servicos),
                    },
                    {
                      key: "nota" as const,
                      label: "Nota",
                      value: selected.rating != null ? `${selected.rating.toFixed(1)} ★` : "—",
                    },
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
                      <p
                        className={`text-xs ${detailView === key ? "text-slate-500" : "text-white/60"}`}
                      >
                        {label}
                      </p>
                      <p className="font-bold text-sm">{value}</p>
                      <p
                        className={`text-[9px] mt-0.5 ${detailView === key ? "text-brand" : "text-white/40"}`}
                      >
                        {detailView === key ? "fechar ▲" : "ver ▼"}
                      </p>
                    </button>
                  ))}
                </div>

                {detailView && <ProDetailView proId={selected.id} view={detailView} />}
              </div>

              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">Status</p>
                    <p className="text-xs text-slate-400">
                      {selected.ativo ? "Ativo na plataforma" : "Desativado"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleAtivo(selected)}
                    disabled={togglingId === selected.id}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${selected.ativo ? "bg-green-500" : "bg-slate-200"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${selected.ativo ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </div>

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

                <div className="py-3 border-y border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Gênero</p>
                    <p className="text-sm font-medium capitalize">
                      {selected.genero === "nao_informar" ? "Não informado" : selected.genero}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-slate-400 uppercase">Especialidades</p>
                    <button
                      onClick={() => {
                        setEditingEsp(!editingEsp);
                        setEspSelected([...selected.especialidades]);
                      }}
                      className="text-[10px] font-bold text-brand hover:underline"
                    >
                      {editingEsp ? "Cancelar" : "Editar"}
                    </button>
                  </div>
                  {editingEsp ? (
                    <div className="space-y-6">
                      {ESPECIALIDADES_OPCOES.map((cat) => {
                        const allSelected = cat.opcoes.every((opt) => espSelected.includes(opt));

                        return (
                          <div
                            key={cat.categoria}
                            className="bg-slate-50 p-4 rounded-2xl border border-slate-100"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                <cat.icon className="h-3.5 w-3.5" /> {cat.categoria}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  if (allSelected) {
                                    setEspSelected(
                                      espSelected.filter((e) => !cat.opcoes.includes(e)),
                                    );
                                  } else {
                                    const others = espSelected.filter(
                                      (e) => !cat.opcoes.includes(e),
                                    );
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
                                    onClick={() =>
                                      setEspSelected(
                                        checked
                                          ? espSelected.filter((e) => e !== esp)
                                          : [...espSelected, esp],
                                      )
                                    }
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
                            {espSelected.length} selecionada
                            {espSelected.length !== 1 ? "s" : ""}
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
                        <Button
                          onClick={handleSaveEsp}
                          disabled={savingEsp}
                          size="lg"
                          className="w-full bg-brand text-white rounded-2xl h-12 font-bold shadow-lg shadow-brand/20"
                        >
                          {savingEsp ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            "Salvar especialidades"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selected.especialidades.length > 0 ? (
                        selected.especialidades.map((e: string) => (
                          <span
                            key={e}
                            className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium"
                          >
                            {e}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">Nenhuma especialidade cadastrada</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                  {selected.slug && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl justify-start gap-2"
                    >
                      <Link to="/profissionais/perfil/$slug" params={{ slug: selected.slug }}>
                        <ArrowUpRight className="h-4 w-4" /> Ver perfil público
                      </Link>
                    </Button>
                  )}
                  {selected.whatsapp && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl justify-start gap-2 text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <a
                        href={`https://wa.me/${selected.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
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
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Excluir Profissional
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
        </>
      )}



      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Novo Profissional</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreatePro} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                    Nome Completo
                  </label>
                  <input
                    required
                    value={newPro.nome}
                    onChange={(e) => setNewPro({ ...newPro, nome: e.target.value })}
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
                    onChange={(e) => setNewPro({ ...newPro, email: e.target.value })}
                    placeholder="joao@exemplo.com"
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand/20 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                    Senha Provisória
                  </label>
                  <input
                    required
                    type="password"
                    value={newPro.password}
                    onChange={(e) => setNewPro({ ...newPro, password: e.target.value })}
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
