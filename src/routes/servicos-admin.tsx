import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { type Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  salvarServico,
  toggleServicoAtivo,
  vincularMaterial,
  desvincularMaterial,
  deletarServico,
} from "@/lib/servicos-admin.functions";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Wrench,
  Package,
  CheckCircle2,
  XCircle,
  DollarSign,
  Tag,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
} from "lucide-react";

export const Route = createFileRoute("/servicos-admin")({
  component: ServicosAdmin,
});

type TipoPreco = "fixo" | "range" | "sob_orcamento";

type Servico = {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  tipo_preco: TipoPreco;
  preco_fixo: number | null;
  preco_min: number | null;
  preco_max: number | null;
  is_fixed_price: boolean;
  comissao_marketplace_pct: number;
  ativo: boolean;
};

type Material = {
  id: string;
  nome: string;
  unidade: string;
  preco_atual: number;
};

type Vinculo = {
  id: string;
  service_id: string;
  material_id: string;
  quantidade_sugerida: number;
  material: Material | null;
};

const CATEGORIAS = [
  "montagem",
  "reparos",
  "elétrica",
  "hidráulica",
  "chaveiro",
  "instalação",
  "pintura",
  "limpeza",
  "engenharia",
  "outro",
];

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

function inferTipo(s: any): TipoPreco {
  if (s.is_fixed_price) return "fixo";
  if (s.preco_min != null || s.preco_max != null) return "range";
  return "sob_orcamento";
}

function emptyServico(): Servico {
  return {
    id: "",
    nome: "",
    categoria: "",
    descricao: "",
    tipo_preco: "range",
    preco_fixo: null,
    preco_min: 0,
    preco_max: 0,
    is_fixed_price: false,
    comissao_marketplace_pct: 15,
    ativo: true,
  };
}

function precoLabel(s: Servico) {
  if (s.tipo_preco === "fixo" && s.preco_fixo != null) return brl(s.preco_fixo);
  if (s.tipo_preco === "range" && s.preco_min != null && s.preco_max != null)
    return `${brl(s.preco_min)} – ${brl(s.preco_max)}`;
  return "Sob orçamento";
}

const CAT_COLORS: Record<string, string> = {
  montagem: "bg-blue-50 text-blue-700",
  reparos: "bg-orange-50 text-orange-700",
  elétrica: "bg-yellow-50 text-yellow-700",
  hidráulica: "bg-cyan-50 text-cyan-700",
  chaveiro: "bg-amber-50 text-amber-700",
  instalação: "bg-indigo-50 text-indigo-700",
  pintura: "bg-purple-50 text-purple-700",
  limpeza: "bg-green-50 text-green-700",
  engenharia: "bg-slate-100 text-slate-700",
  outro: "bg-rose-50 text-rose-700",
};

function catColor(cat: string) {
  return CAT_COLORS[cat.toLowerCase()] ?? "bg-slate-100 text-slate-600";
}

function ServicosAdmin() {
  const { user, isAdmin, loading, session } = useAuth();
  const navigate = useNavigate();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [vinculos, setVinculos] = useState<Record<string, Vinculo[]>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<Servico | null>(null);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<"todos" | "ativo" | "inativo">("todos");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const salvar = useServerFn(salvarServico);
  const toggleAtivo = useServerFn(toggleServicoAtivo);
  const vincular = useServerFn(vincularMaterial);
  const desvincular = useServerFn(desvincularMaterial);
  const deletar = useServerFn(deletarServico);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const refresh = async () => {
    setLoadingList(true);
    const [s, m, sm] = await Promise.all([
      supabase.from("services_catalog").select("*").order("categoria").order("nome"),
      supabase
        .from("materiais")
        .select("id,nome,unidade,preco_atual")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("service_materiais")
        .select(
          "id,service_id,material_id,quantidade_sugerida,material:materiais(id,nome,unidade,preco_atual)",
        ),
    ]);
    setServicos(
      ((s.data ?? []) as Tables<"services_catalog">[]).map((r) => ({
        ...r,
        tipo_preco: inferTipo(r),
        preco_fixo: r.preco_fixo != null ? Number(r.preco_fixo) : null,
        preco_min: r.preco_min != null ? Number(r.preco_min) : null,
        preco_max: r.preco_max != null ? Number(r.preco_max) : null,
        comissao_marketplace_pct:
          r.comissao_marketplace_pct != null ? Number(r.comissao_marketplace_pct) : 15,
      })),
    );
    setMateriais(
      ((m.data ?? []) as Tables<"materiais">[]).map((r) => ({ ...r, preco_atual: Number(r.preco_atual) })),
    );
    const grouped: Record<string, Vinculo[]> = {};
    for (const v of (sm.data ?? []) as unknown as (Tables<"service_materiais"> & { material: Tables<"materiais"> | null })[]) {
      const item: Vinculo = {
        id: v.id,
        service_id: v.service_id,
        material_id: v.material_id,
        quantidade_sugerida: Number(v.quantidade_sugerida),
        material: v.material
          ? { ...v.material, preco_atual: Number(v.material.preco_atual) }
          : null,
      };
      (grouped[v.service_id] ??= []).push(item);
    }
    setVinculos(grouped);
    setLoadingList(false);
  };

  useEffect(() => {
    if (user && isAdmin) refresh();
  }, [user, isAdmin]);

  const filtered = useMemo(
    () =>
      servicos.filter((s) => {
        if (
          search &&
          !s.nome.toLowerCase().includes(search.toLowerCase()) &&
          !s.categoria.toLowerCase().includes(search.toLowerCase())
        )
          return false;
        if (filterCat && s.categoria !== filterCat) return false;
        if (filterAtivo === "ativo" && !s.ativo) return false;
        if (filterAtivo === "inativo" && s.ativo) return false;
        return true;
      }),
    [servicos, search, filterCat, filterAtivo],
  );

  const categorias = useMemo(
    () => [...new Set(servicos.map((s) => s.categoria))].sort(),
    [servicos],
  );

  const stats = useMemo(
    () => ({
      total: servicos.length,
      ativos: servicos.filter((s) => s.ativo).length,
      inativos: servicos.filter((s) => !s.ativo).length,
      categorias: new Set(servicos.map((s) => s.categoria)).size,
    }),
    [servicos],
  );

  if (loading)
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  if (!isAdmin)
    return (
      <div className="max-w-md mx-auto py-32 text-center px-4">
        <h1 className="text-2xl font-bold mb-3">Acesso restrito</h1>
        <Link to="/" className="text-brand font-bold underline">
          Voltar
        </Link>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <Link
              to="/admin"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="h-3 w-3" /> Voltar ao admin
            </Link>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Wrench className="h-7 w-7 text-brand" /> Catálogo de Serviços
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Gerencie os serviços ofertados, preços e materiais sugeridos.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/materiais-admin">
              <Button variant="outline" className="rounded-full gap-2">
                <Package className="h-4 w-4" /> Materiais
              </Button>
            </Link>
            <Button
              onClick={() => {
                setCreating(true);
                setEditing(emptyServico());
              }}
              className="rounded-full bg-brand text-white gap-2"
            >
              <Plus className="h-4 w-4" /> Novo serviço
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total", value: stats.total, icon: Tag, color: "text-slate-600 bg-slate-100" },
            {
              label: "Ativos",
              value: stats.ativos,
              icon: CheckCircle2,
              color: "text-green-600 bg-green-50",
            },
            {
              label: "Inativos",
              value: stats.inativos,
              icon: XCircle,
              color: "text-red-500 bg-red-50",
            },
            {
              label: "Categorias",
              value: stats.categorias,
              icon: Filter,
              color: "text-brand bg-brand/10",
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4"
            >
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        {editing && (
          <ServicoForm
            servico={editing}
            isNew={creating}
            onCancel={() => {
              setEditing(null);
              setCreating(false);
            }}
            onSave={async (s) => {
              try {
                await salvar({
                  headers: { Authorization: `Bearer ${session?.access_token}` },
                  data: {
                    id: creating ? undefined : s.id,
                    nome: s.nome,
                    categoria: s.categoria,
                    descricao: s.descricao || null,
                    tipo_preco: s.tipo_preco,
                    preco_fixo: s.preco_fixo,
                    preco_min: s.preco_min,
                    preco_max: s.preco_max,
                    comissao_marketplace_pct: s.comissao_marketplace_pct,
                    ativo: s.ativo,
                  },
                });
                toast.success(creating ? "Serviço criado!" : "Serviço atualizado!");
                setEditing(null);
                setCreating(false);
                await refresh();
              } catch (e: any) {
                toast.error("Falha", { description: e?.message });
              }
            }}
          />
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 shadow-sm flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar serviço..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-slate-50 text-sm"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="h-10 px-3 rounded-xl border border-border bg-slate-50 text-sm"
          >
            <option value="">Todas categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filterAtivo}
            onChange={(e) => setFilterAtivo(e.target.value as "todos" | "ativo" | "inativo")}
            className="h-10 px-3 rounded-xl border border-border bg-slate-50 text-sm"
          >
            <option value="todos">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
          <p className="text-xs text-muted-foreground ml-auto">
            {filtered.length} de {servicos.length}
          </p>
        </div>

        {/* List */}
        {loadingList ? (
          <div className="p-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
            <Wrench className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhum serviço encontrado.</p>
            <Button
              onClick={() => {
                setCreating(true);
                setEditing(emptyServico());
              }}
              className="mt-4 rounded-full bg-brand text-white gap-2"
            >
              <Plus className="h-4 w-4" /> Criar serviço
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => {
              const vs = vinculos[s.id] ?? [];
              const isOpen = expanded === s.id;
              const custo = vs.reduce(
                (acc, v) => acc + (v.material?.preco_atual ?? 0) * v.quantidade_sugerida,
                0,
              );
              return (
                <div
                  key={s.id}
                  className={`bg-white rounded-2xl border overflow-hidden transition-all ${!s.ativo ? "opacity-60" : ""} ${confirmDelete === s.id ? "border-red-300 ring-2 ring-red-200" : "border-slate-200"}`}
                >
                  <div className="flex items-center gap-4 p-5 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${catColor(s.categoria)}`}
                        >
                          {s.categoria}
                        </span>
                        {!s.ativo && (
                          <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-400 px-2.5 py-0.5 rounded-full">
                            Inativo
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${s.tipo_preco === "fixo" ? "bg-emerald-50 text-emerald-700" : s.tipo_preco === "range" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}
                        >
                          {s.tipo_preco === "fixo"
                            ? "Preço fixo"
                            : s.tipo_preco === "range"
                              ? "Faixa de preço"
                              : "Sob orçamento"}
                        </span>
                        <span className="text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">
                          Comissão: {(s.comissao_marketplace_pct ?? 15).toFixed(2)}%
                        </span>
                      </div>
                      <h3 className="font-bold text-base">{s.nome}</h3>
                      {s.descricao && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {s.descricao}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <span className="text-sm font-bold text-brand flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          {precoLabel(s)}
                        </span>
                        {vs.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {vs.length} material(is) · custo estimado: {brl(custo)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full gap-1 text-xs"
                        onClick={() => setExpanded(isOpen ? null : s.id)}
                      >
                        <Package className="h-3 w-3" /> Materiais{" "}
                        {isOpen ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full"
                        onClick={() => {
                          setCreating(false);
                          setEditing(s);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-xs font-bold"
                        onClick={async () => {
                          try {
                            await toggleAtivo({ headers: { Authorization: `Bearer ${session?.access_token}` }, data: { id: s.id, ativo: !s.ativo } });
                            await refresh();
                          } catch (e: any) {
                            toast.error("Falha", { description: e?.message });
                          }
                        }}
                      >
                        {s.ativo ? "Desativar" : "Ativar"}
                      </Button>
                      {confirmDelete === s.id ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="rounded-full text-xs"
                            onClick={async () => {
                              try {
                                await deletar({ headers: { Authorization: `Bearer ${session?.access_token}` }, data: { id: s.id } });
                                toast.success("Excluído");
                                setConfirmDelete(null);
                                await refresh();
                              } catch (e: any) {
                                toast.error("Falha", { description: e?.message });
                              }
                            }}
                          >
                            Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full text-xs"
                            onClick={() => setConfirmDelete(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmDelete(s.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-5 space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Materiais sugeridos
                      </p>
                      {vs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum material vinculado.</p>
                      ) : (
                        <div className="grid sm:grid-cols-2 gap-2">
                          {vs.map((v) => (
                            <div
                              key={v.id}
                              className="flex items-center gap-3 bg-white border border-border rounded-xl px-3 py-2"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">
                                  {v.material?.nome ?? "?"}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {v.quantidade_sugerida} {v.material?.unidade ?? ""} ·{" "}
                                  {v.material ? brl(v.material.preco_atual) : "—"}/un · total:{" "}
                                  {v.material
                                    ? brl(v.material.preco_atual * v.quantidade_sugerida)
                                    : "—"}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive rounded-full shrink-0"
                                onClick={async () => {
                                  try {
                                    await desvincular({ data: { id: v.id } });
                                    await refresh();
                                  } catch (e: any) {
                                    toast.error("Falha", { description: e?.message });
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <AddMaterialForm
                        materiais={materiais}
                        jaVinculados={new Set(vs.map((v) => v.material_id))}
                        onAdd={async (materialId, qtd) => {
                          try {
                            await vincular({
                              data: {
                                service_id: s.id,
                                material_id: materialId,
                                quantidade_sugerida: qtd,
                              },
                            });
                            toast.success("Material vinculado");
                            await refresh();
                          } catch (e: any) {
                            toast.error("Falha", { description: e?.message });
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ServicoForm({
  servico,
  isNew,
  onCancel,
  onSave,
}: {
  servico: Servico;
  isNew: boolean;
  onCancel: () => void;
  onSave: (s: Servico) => Promise<void>;
}) {
  const [s, setS] = useState<Servico>(servico);
  const [saving, setSaving] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-brand/30 p-6 mb-5 shadow-lg space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">
          {isNew ? "✦ Novo serviço" : `Editar · ${servico.nome}`}
        </h3>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onCancel}>
          ✕
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground">
              Nome do serviço *
            </label>
            <input
              value={s.nome}
              onChange={(e) => setS({ ...s, nome: e.target.value })}
              maxLength={160}
              placeholder="Ex: Instalação de tomadas"
              className="w-full mt-1.5 h-11 px-4 rounded-xl border border-border bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground">Categoria *</label>
            <div className="flex gap-2 mt-1.5">
              <select
                value={s.categoria}
                onChange={(e) => setS({ ...s, categoria: e.target.value })}
                className="flex-1 h-11 px-3 rounded-xl border border-border bg-slate-50 text-sm"
              >
                <option value="">Selecione…</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                value={s.categoria}
                onChange={(e) => setS({ ...s, categoria: e.target.value })}
                placeholder="ou digite"
                className="w-32 h-11 px-3 rounded-xl border border-border bg-slate-50 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Tipo de precificação
          </label>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {(["range", "fixo", "sob_orcamento"] as TipoPreco[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setS({ ...s, tipo_preco: t })}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${s.tipo_preco === t ? "bg-brand text-white border-brand" : "border-border bg-slate-50 text-slate-600 hover:border-brand/40"}`}
              >
                {t === "range" ? "Faixa (mín–máx)" : t === "fixo" ? "Preço fixo" : "Sob orçamento"}
              </button>
            ))}
          </div>
        </div>

        {s.tipo_preco === "range" && (
          <>
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Preço mínimo (R$)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={s.preco_min ?? ""}
                onChange={(e) => setS({ ...s, preco_min: Number(e.target.value) || 0 })}
                className="w-full mt-1.5 h-11 px-4 rounded-xl border border-border bg-slate-50 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Preço máximo (R$)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={s.preco_max ?? ""}
                onChange={(e) => setS({ ...s, preco_max: Number(e.target.value) || 0 })}
                className="w-full mt-1.5 h-11 px-4 rounded-xl border border-border bg-slate-50 text-sm"
              />
            </div>
          </>
        )}

        {s.tipo_preco === "fixo" && (
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground">
              Preço fixo (R$)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={s.preco_fixo ?? ""}
              onChange={(e) => setS({ ...s, preco_fixo: Number(e.target.value) || 0 })}
              className="w-full mt-1.5 h-11 px-4 rounded-xl border border-border bg-slate-50 text-sm"
            />
          </div>
        )}

        {s.tipo_preco === "sob_orcamento" && (
          <div className="sm:col-span-2 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <strong>Sob orçamento:</strong> O profissional definirá o valor livremente ao enviar a
            proposta. Nenhuma faixa de referência será exibida.
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Comissão do Marketplace (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={s.comissao_marketplace_pct ?? 15}
            onChange={(e) => setS({ ...s, comissao_marketplace_pct: Number(e.target.value) ?? 15 })}
            className="w-full mt-1.5 h-11 px-4 rounded-xl border border-border bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Percentual descontado do profissional ao receber o pagamento
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">Descrição</label>
          <textarea
            value={s.descricao ?? ""}
            onChange={(e) => setS({ ...s, descricao: e.target.value })}
            maxLength={2000}
            rows={3}
            placeholder="Descreva o serviço, o que está incluído, condições..."
            className="w-full mt-1.5 px-4 py-3 rounded-xl border border-border bg-slate-50 text-sm resize-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={s.ativo}
              onChange={(e) => setS({ ...s, ativo: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-200 peer-checked:bg-brand rounded-full transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
          </label>
          <span className="text-sm font-medium">
            {s.ativo ? "Ativo — aparece para clientes" : "Inativo — oculto"}
          </span>
        </div>
      </div>

      <div className="flex gap-3 pt-2 border-t border-border">
        <Button variant="outline" onClick={onCancel} disabled={saving} className="rounded-full">
          Cancelar
        </Button>
        <Button
          disabled={saving}
          className="rounded-full bg-brand text-white font-bold px-8"
          onClick={async () => {
            if (!s.nome.trim() || !s.categoria.trim()) {
              toast.error("Nome e categoria são obrigatórios");
              return;
            }
            if (s.tipo_preco === "range" && (s.preco_max ?? 0) < (s.preco_min ?? 0)) {
              toast.error("Preço máximo deve ser ≥ mínimo");
              return;
            }
            if (s.tipo_preco === "fixo" && !(s.preco_fixo ?? 0)) {
              toast.error("Informe o preço fixo");
              return;
            }
            setSaving(true);
            await onSave(s);
            setSaving(false);
          }}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isNew ? (
            "Criar serviço"
          ) : (
            "Salvar alterações"
          )}
        </Button>
      </div>
    </div>
  );
}

function AddMaterialForm({
  materiais,
  jaVinculados,
  onAdd,
}: {
  materiais: Material[];
  jaVinculados: Set<string>;
  onAdd: (materialId: string, qtd: number) => Promise<void>;
}) {
  const disponiveis = materiais.filter((m) => !jaVinculados.has(m.id));
  const [materialId, setMaterialId] = useState("");
  const [qtd, setQtd] = useState(1);
  const [saving, setSaving] = useState(false);
  if (disponiveis.length === 0)
    return (
      <p className="text-xs text-muted-foreground italic">
        Todos os materiais já estão vinculados.
      </p>
    );
  return (
    <div className="flex gap-2 flex-wrap items-end pt-3 border-t border-border">
      <div className="flex-1 min-w-[180px]">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">
          Adicionar material
        </label>
        <select
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
          className="w-full mt-1 h-10 px-2 rounded-xl border border-border bg-white text-sm"
        >
          <option value="">Selecione…</option>
          {disponiveis.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome} ({brl(m.preco_atual)}/{m.unidade})
            </option>
          ))}
        </select>
      </div>
      <div className="w-28">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">
          Qtd. sugerida
        </label>
        <input
          type="number"
          min={0.01}
          step="0.01"
          value={qtd}
          onChange={(e) => setQtd(Number(e.target.value) || 0)}
          className="w-full mt-1 h-10 px-2 rounded-xl border border-border bg-white text-sm"
        />
      </div>
      <Button
        size="sm"
        disabled={!materialId || qtd <= 0 || saving}
        onClick={async () => {
          setSaving(true);
          await onAdd(materialId, qtd);
          setMaterialId("");
          setQtd(1);
          setSaving(false);
        }}
        className="bg-brand text-white rounded-full gap-1"
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}{" "}
        Vincular
      </Button>
    </div>
  );
}
