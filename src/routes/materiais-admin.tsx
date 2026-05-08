import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { atualizarPrecoMaterialMarketplace, salvarMaterial } from "@/lib/materiais.functions";
import {
  Loader2,
  RefreshCw,
  Plus,
  Pencil,
  Package,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/materiais-admin")({
  component: MateriaisAdmin,
});

type Material = {
  id: string;
  nome: string;
  unidade: string;
  preco_base: number;
  preco_atual: number;
  preco_fonte: string;
  preco_atualizado_em: string;
  marketplace_url: string | null;
  ativo: boolean;
};

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

function MateriaisAdmin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<Material[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [editing, setEditing] = useState<Material | null>(null);
  const [creating, setCreating] = useState(false);

  const atualizar = useServerFn(atualizarPrecoMaterialMarketplace);
  const salvar = useServerFn(salvarMaterial);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const refresh = async () => {
    const { data } = await supabase.from("materiais").select("*").order("nome");
    setList(
      (data ?? []).map((m: any) => ({
        ...m,
        preco_base: Number(m.preco_base),
        preco_atual: Number(m.preco_atual),
      })),
    );
    setLoadingList(false);
  };

  useEffect(() => {
    if (user && isAdmin) refresh();
  }, [user, isAdmin]);

  const handleAtualizar = async (id: string) => {
    setUpdating(id);
    try {
      await atualizar({ data: { materialId: id } });
      toast.success("Preço atualizado via marketplace");
      await refresh();
    } catch (e: any) {
      toast.error("Falha", { description: e?.message });
    } finally {
      setUpdating(null);
    }
  };

  if (loading)
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-32 text-center px-4">
        <h1 className="text-2xl font-bold mb-3">Acesso restrito</h1>
        <p className="text-muted-foreground mb-6">Esta área é exclusiva para admins.</p>
        <Link to="/" className="text-brand font-bold underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="h-3 w-3" /> Voltar ao admin
          </Link>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Package className="h-7 w-7 text-brand" /> Materiais
          </h1>
          <p className="text-muted-foreground mt-1">Catálogo de materiais para taxa adicional dos orçamentos.</p>
        </div>
        <Button
          onClick={() => {
            setCreating(true);
            setEditing({
              id: "",
              nome: "",
              unidade: "un",
              preco_base: 0,
              preco_atual: 0,
              preco_fonte: "tabela",
              preco_atualizado_em: "",
              marketplace_url: "",
              ativo: true,
            });
          }}
          className="rounded-full bg-brand text-brand-foreground gap-2"
        >
          <Plus className="h-4 w-4" /> Novo material
        </Button>
      </div>

      {editing && (
        <MaterialForm
          material={editing}
          isNew={creating}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={async (m) => {
            try {
              await salvar({
                data: {
                  id: creating ? undefined : m.id,
                  nome: m.nome,
                  unidade: m.unidade,
                  preco_base: m.preco_base,
                  marketplace_url: m.marketplace_url || null,
                  ativo: m.ativo,
                },
              });
              toast.success(creating ? "Material criado" : "Material atualizado");
              setEditing(null);
              setCreating(false);
              await refresh();
            } catch (e: any) {
              toast.error("Falha", { description: e?.message });
            }
          }}
        />
      )}

      {loadingList ? (
        <div className="p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Un.</th>
                <th className="text-right px-4 py-3">Preço base</th>
                <th className="text-right px-4 py-3">Preço atual</th>
                <th className="text-left px-4 py-3">Fonte</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{m.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.unidade}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{brl(m.preco_base)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">{brl(m.preco_atual)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        m.preco_fonte === "marketplace"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {m.preco_fonte}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAtualizar(m.id)}
                        disabled={updating === m.id}
                        className="rounded-full gap-1"
                      >
                        {updating === m.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Marketplace
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setCreating(false);
                          setEditing(m);
                        }}
                        className="rounded-full gap-1"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted-foreground py-12">
                    Nenhum material cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MaterialForm({
  material,
  isNew,
  onCancel,
  onSave,
}: {
  material: Material;
  isNew: boolean;
  onCancel: () => void;
  onSave: (m: Material) => Promise<void>;
}) {
  const [m, setM] = useState(material);
  const [saving, setSaving] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-border p-6 mb-6 shadow-soft space-y-3">
      <h3 className="font-bold text-lg">{isNew ? "Novo material" : `Editar ${material.nome}`}</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase font-bold text-muted-foreground">Nome</label>
          <input
            value={m.nome}
            onChange={(e) => setM({ ...m, nome: e.target.value })}
            maxLength={120}
            className="w-full mt-1 h-11 px-3 rounded-xl border border-border bg-slate-50"
          />
        </div>
        <div>
          <label className="text-xs uppercase font-bold text-muted-foreground">Unidade</label>
          <input
            value={m.unidade}
            onChange={(e) => setM({ ...m, unidade: e.target.value })}
            maxLength={20}
            className="w-full mt-1 h-11 px-3 rounded-xl border border-border bg-slate-50"
          />
        </div>
        <div>
          <label className="text-xs uppercase font-bold text-muted-foreground">Preço base (R$)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={m.preco_base}
            onChange={(e) => setM({ ...m, preco_base: Number(e.target.value) || 0 })}
            className="w-full mt-1 h-11 px-3 rounded-xl border border-border bg-slate-50"
          />
        </div>
        <div>
          <label className="text-xs uppercase font-bold text-muted-foreground">URL marketplace (opcional)</label>
          <input
            value={m.marketplace_url ?? ""}
            onChange={(e) => setM({ ...m, marketplace_url: e.target.value })}
            maxLength={500}
            placeholder="https://…"
            className="w-full mt-1 h-11 px-3 rounded-xl border border-border bg-slate-50"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving} className="rounded-full">
          Cancelar
        </Button>
        <Button
          onClick={async () => {
            if (!m.nome.trim()) {
              toast.error("Nome obrigatório");
              return;
            }
            setSaving(true);
            await onSave(m);
            setSaving(false);
          }}
          disabled={saving}
          className="bg-foreground text-background rounded-full font-bold"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
