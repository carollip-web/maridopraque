import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  salvarServico,
  toggleServicoAtivo,
  vincularMaterial,
  desvincularMaterial,
} from "@/lib/servicos-admin.functions";
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, Wrench, Package } from "lucide-react";

export const Route = createFileRoute("/servicos-admin")({
  component: ServicosAdmin,
});

type Servico = {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  preco_min: number | null;
  preco_max: number | null;
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

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

function emptyServico(): Servico {
  return { id: "", nome: "", categoria: "", descricao: "", preco_min: 0, preco_max: 0, ativo: true };
}

function ServicosAdmin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [vinculos, setVinculos] = useState<Record<string, Vinculo[]>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<Servico | null>(null);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const salvar = useServerFn(salvarServico);
  const toggleAtivo = useServerFn(toggleServicoAtivo);
  const vincular = useServerFn(vincularMaterial);
  const desvincular = useServerFn(desvincularMaterial);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const refresh = async () => {
    setLoadingList(true);
    const [s, m, sm] = await Promise.all([
      supabase.from("services_catalog").select("*").order("categoria").order("nome"),
      supabase.from("materiais").select("id, nome, unidade, preco_atual").eq("ativo", true).order("nome"),
      supabase.from("service_materiais").select("id, service_id, material_id, quantidade_sugerida, material:materiais(id, nome, unidade, preco_atual)"),
    ]);
    setServicos(((s.data ?? []) as any[]).map((r) => ({
      ...r,
      preco_min: r.preco_min == null ? 0 : Number(r.preco_min),
      preco_max: r.preco_max == null ? 0 : Number(r.preco_max),
    })));
    setMateriais(((m.data ?? []) as any[]).map((r) => ({ ...r, preco_atual: Number(r.preco_atual) })));
    const grouped: Record<string, Vinculo[]> = {};
    for (const v of (sm.data ?? []) as any[]) {
      const item: Vinculo = {
        id: v.id,
        service_id: v.service_id,
        material_id: v.material_id,
        quantidade_sugerida: Number(v.quantidade_sugerida),
        material: v.material ? { ...v.material, preco_atual: Number(v.material.preco_atual) } : null,
      };
      (grouped[v.service_id] ??= []).push(item);
    }
    setVinculos(grouped);
    setLoadingList(false);
  };

  useEffect(() => { if (user && isAdmin) refresh(); }, [user, isAdmin]);

  if (loading) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  if (!isAdmin) return (
    <div className="max-w-md mx-auto py-32 text-center px-4">
      <h1 className="text-2xl font-bold mb-3">Acesso restrito</h1>
      <Link to="/" className="text-brand font-bold underline">Voltar</Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="h-3 w-3" /> Voltar ao admin
          </Link>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wrench className="h-7 w-7 text-brand" /> Catálogo de serviços
          </h1>
          <p className="text-muted-foreground mt-1">Defina range de preços e materiais sugeridos por serviço.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/materiais-admin"><Button variant="outline" className="rounded-full gap-2"><Package className="h-4 w-4" /> Materiais</Button></Link>
          <Button
            onClick={() => { setCreating(true); setEditing(emptyServico()); }}
            className="rounded-full bg-brand text-brand-foreground gap-2">
            <Plus className="h-4 w-4" /> Novo serviço
          </Button>
        </div>
      </div>

      {editing && (
        <ServicoForm
          servico={editing}
          isNew={creating}
          onCancel={() => { setEditing(null); setCreating(false); }}
          onSave={async (s) => {
            try {
              await salvar({ data: {
                id: creating ? undefined : s.id,
                nome: s.nome, categoria: s.categoria,
                descricao: s.descricao || null,
                preco_min: Number(s.preco_min) || 0,
                preco_max: Number(s.preco_max) || 0,
                ativo: s.ativo,
              }});
              toast.success(creating ? "Serviço criado" : "Serviço atualizado");
              setEditing(null); setCreating(false);
              await refresh();
            } catch (e: any) { toast.error("Falha", { description: e?.message }); }
          }}
        />
      )}

      {loadingList ? (
        <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {servicos.map((s) => {
            const vs = vinculos[s.id] ?? [];
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-border overflow-hidden">
                <div className="flex items-center justify-between p-4 gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{s.categoria}</span>
                      {!s.ativo && <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inativo</span>}
                    </div>
                    <h3 className="font-bold text-base truncate">{s.nome}</h3>
                    <p className="text-xs text-muted-foreground">
                      Range: <span className="font-semibold tabular-nums">{brl(Number(s.preco_min ?? 0))} – {brl(Number(s.preco_max ?? 0))}</span> · {vs.length} material(is)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="rounded-full gap-1"
                      onClick={() => setExpanded(isOpen ? null : s.id)}>
                      <Package className="h-3 w-3" /> {isOpen ? "Fechar" : "Materiais"}
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-full"
                      onClick={() => { setCreating(false); setEditing(s); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-full text-xs"
                      onClick={async () => {
                        try { await toggleAtivo({ data: { id: s.id, ativo: !s.ativo } }); await refresh(); }
                        catch (e: any) { toast.error("Falha", { description: e?.message }); }
                      }}>
                      {s.ativo ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-border bg-slate-50/50 p-4 space-y-3">
                    {vs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum material vinculado.</p>
                    ) : (
                      <div className="space-y-2">
                        {vs.map((v) => (
                          <div key={v.id} className="flex items-center gap-3 bg-white border border-border rounded-xl px-3 py-2">
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{v.material?.nome ?? "?"}</p>
                              <p className="text-[11px] text-muted-foreground">
                                Sugerido: {v.quantidade_sugerida} {v.material?.unidade ?? ""} · {v.material ? brl(v.material.preco_atual) : "—"} / un
                              </p>
                            </div>
                            <Button size="sm" variant="ghost" className="text-destructive rounded-full"
                              onClick={async () => {
                                try { await desvincular({ data: { id: v.id } }); await refresh(); }
                                catch (e: any) { toast.error("Falha", { description: e?.message }); }
                              }}>
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
                          await vincular({ data: { service_id: s.id, material_id: materialId, quantidade_sugerida: qtd } });
                          toast.success("Material vinculado");
                          await refresh();
                        } catch (e: any) { toast.error("Falha", { description: e?.message }); }
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {servicos.length === 0 && (
            <div className="text-center text-muted-foreground py-12">Nenhum serviço cadastrado.</div>
          )}
        </div>
      )}
    </div>
  );
}

function ServicoForm({ servico, isNew, onCancel, onSave }: {
  servico: Servico; isNew: boolean; onCancel: () => void; onSave: (s: Servico) => Promise<void>;
}) {
  const [s, setS] = useState(servico);
  const [saving, setSaving] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-border p-6 mb-6 shadow-soft space-y-3">
      <h3 className="font-bold text-lg">{isNew ? "Novo serviço" : `Editar ${servico.nome}`}</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase font-bold text-muted-foreground">Nome</label>
          <input value={s.nome} onChange={(e) => setS({ ...s, nome: e.target.value })} maxLength={160}
            className="w-full mt-1 h-11 px-3 rounded-xl border border-border bg-slate-50" />
        </div>
        <div>
          <label className="text-xs uppercase font-bold text-muted-foreground">Categoria</label>
          <input value={s.categoria} onChange={(e) => setS({ ...s, categoria: e.target.value })} maxLength={80}
            className="w-full mt-1 h-11 px-3 rounded-xl border border-border bg-slate-50" />
        </div>
        <div>
          <label className="text-xs uppercase font-bold text-muted-foreground">Preço mínimo (R$)</label>
          <input type="number" min={0} step="0.01" value={s.preco_min ?? 0}
            onChange={(e) => setS({ ...s, preco_min: Number(e.target.value) || 0 })}
            className="w-full mt-1 h-11 px-3 rounded-xl border border-border bg-slate-50" />
        </div>
        <div>
          <label className="text-xs uppercase font-bold text-muted-foreground">Preço máximo (R$)</label>
          <input type="number" min={0} step="0.01" value={s.preco_max ?? 0}
            onChange={(e) => setS({ ...s, preco_max: Number(e.target.value) || 0 })}
            className="w-full mt-1 h-11 px-3 rounded-xl border border-border bg-slate-50" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs uppercase font-bold text-muted-foreground">Descrição</label>
          <textarea value={s.descricao ?? ""} onChange={(e) => setS({ ...s, descricao: e.target.value })}
            maxLength={2000} rows={2}
            className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-slate-50" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.ativo} onChange={(e) => setS({ ...s, ativo: e.target.checked })} />
          Ativo
        </label>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving} className="rounded-full">Cancelar</Button>
        <Button onClick={async () => {
          if (!s.nome.trim() || !s.categoria.trim()) { toast.error("Nome e categoria obrigatórios"); return; }
          if ((s.preco_max ?? 0) < (s.preco_min ?? 0)) { toast.error("Preço máximo deve ser >= mínimo"); return; }
          setSaving(true); await onSave(s); setSaving(false);
        }} disabled={saving} className="bg-foreground text-background rounded-full font-bold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

function AddMaterialForm({ materiais, jaVinculados, onAdd }: {
  materiais: Material[];
  jaVinculados: Set<string>;
  onAdd: (materialId: string, qtd: number) => Promise<void>;
}) {
  const disponiveis = materiais.filter((m) => !jaVinculados.has(m.id));
  const [materialId, setMaterialId] = useState<string>("");
  const [qtd, setQtd] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  if (disponiveis.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Todos os materiais já vinculados.</p>;
  }

  return (
    <div className="flex gap-2 flex-wrap items-end pt-2 border-t border-border">
      <div className="flex-1 min-w-[180px]">
        <label className="text-[10px] uppercase font-bold text-muted-foreground">Material</label>
        <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}
          className="w-full mt-1 h-10 px-2 rounded-xl border border-border bg-white text-sm">
          <option value="">Selecione…</option>
          {disponiveis.map((m) => (
            <option key={m.id} value={m.id}>{m.nome} ({brl(m.preco_atual)}/{m.unidade})</option>
          ))}
        </select>
      </div>
      <div className="w-28">
        <label className="text-[10px] uppercase font-bold text-muted-foreground">Qtd. sugerida</label>
        <input type="number" min={0.01} step="0.01" value={qtd}
          onChange={(e) => setQtd(Number(e.target.value) || 0)}
          className="w-full mt-1 h-10 px-2 rounded-xl border border-border bg-white text-sm" />
      </div>
      <Button size="sm" disabled={!materialId || qtd <= 0 || saving}
        onClick={async () => {
          setSaving(true);
          await onAdd(materialId, qtd);
          setMaterialId(""); setQtd(1); setSaving(false);
        }}
        className="bg-brand text-brand-foreground rounded-full gap-1">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Vincular
      </Button>
    </div>
  );
}
