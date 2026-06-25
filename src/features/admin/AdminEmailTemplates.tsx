import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Plus, Save, Trash2, Eye, Code2, RefreshCw, CheckCircle2 } from "lucide-react";

type Template = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  assunto: string;
  html: string;
  variaveis: string[];
  ativo: boolean;
  updated_at: string;
};

const EMPTY: Template = {
  id: "",
  slug: "",
  nome: "",
  descricao: "",
  assunto: "",
  html: '<!doctype html><html><body style="font-family:sans-serif;padding:24px">\n  <h1>{{titulo}}</h1>\n  <p>{{mensagem}}</p>\n</body></html>',
  variaveis: [],
  ativo: true,
  updated_at: "",
};

function renderPreview(html: string, vars: Record<string, string>): string {
  let out = html;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  // strip remaining {{var}} placeholders for cleaner preview
  return out.replace(/\{\{[^}]+\}\}/g, "");
}

export function AdminEmailTemplates() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"code" | "preview">("preview");
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await (supabase as any)
      .from("email_templates")
      .select("*")
      .order("nome", { ascending: true });
    if (error) setError(error.message);
    else {
      const rows = (data ?? []).map((r: any) => ({
        ...r,
        variaveis: Array.isArray(r.variaveis) ? r.variaveis : [],
      })) as Template[];
      setItems(rows);
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDraft(null);
      return;
    }
    const found = items.find((t) => t.id === selectedId) ?? null;
    setDraft(found ? { ...found } : null);
    if (found) {
      const defaults: Record<string, string> = {};
      for (const v of found.variaveis) defaults[v] = `[${v}]`;
      setPreviewVars(defaults);
    }
  }, [selectedId, items]);

  const handleNew = () => {
    setSelectedId(null);
    setDraft({ ...EMPTY });
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.slug.trim() || !draft.nome.trim() || !draft.assunto.trim() || !draft.html.trim()) {
      setError("Preencha slug, nome, assunto e HTML.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      slug: draft.slug.trim(),
      nome: draft.nome.trim(),
      descricao: draft.descricao?.trim() || null,
      assunto: draft.assunto,
      html: draft.html,
      variaveis: draft.variaveis,
      ativo: draft.ativo,
    };
    const q = draft.id
      ? (supabase as any).from("email_templates").update(payload).eq("id", draft.id).select().single()
      : (supabase as any).from("email_templates").insert(payload).select().single();
    const { data, error } = await q;
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    await load();
    if (data?.id) setSelectedId(data.id);
  };

  const handleDelete = async () => {
    if (!draft?.id) return;
    if (!confirm(`Excluir template "${draft.nome}"?`)) return;
    const { error } = await (supabase as any).from("email_templates").delete().eq("id", draft.id);
    if (error) {
      setError(error.message);
      return;
    }
    setSelectedId(null);
    setDraft(null);
    load();
  };

  const previewHtml = useMemo(
    () => (draft ? renderPreview(draft.html, previewVars) : ""),
    [draft, previewVars],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Mail className="h-6 w-6 text-orange-500" /> Templates de e-mail
          </h2>
          <p className="text-sm text-slate-500">Edite o assunto e o HTML dos modelos enviados pela plataforma.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500 text-white text-sm hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> Novo
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* List */}
        <aside className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-4 text-sm text-slate-500">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Nenhum template ainda.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left px-3 py-3 hover:bg-slate-50 transition ${
                      selectedId === t.id ? "bg-orange-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900 text-sm truncate">{t.nome}</span>
                      {t.ativo ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <span className="text-[10px] text-slate-400 uppercase">off</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono truncate">{t.slug}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Editor */}
        {draft ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Nome</label>
                <input
                  value={draft.nome}
                  onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Slug (id único)</label>
                <input
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_") })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono"
                  placeholder="ex: notificacao"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Descrição</label>
              <input
                value={draft.descricao ?? ""}
                onChange={(e) => setDraft({ ...draft, descricao: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                placeholder="Quando este template é usado?"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Assunto</label>
              <input
                value={draft.assunto}
                onChange={(e) => setDraft({ ...draft, assunto: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                placeholder="Pode usar {{variavel}}"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">
                Variáveis disponíveis (separadas por vírgula)
              </label>
              <input
                value={draft.variaveis.join(", ")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    variaveis: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono"
                placeholder="titulo, mensagem, link"
              />
              {draft.variaveis.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {draft.variaveis.map((v) => (
                    <code
                      key={v}
                      className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 cursor-pointer"
                      onClick={() => navigator.clipboard.writeText(`{{${v}}}`)}
                      title="Clique para copiar"
                    >
                      {`{{${v}}}`}
                    </code>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.ativo}
                  onChange={(e) => setDraft({ ...draft, ativo: e.target.checked })}
                />
                Template ativo
              </label>
              <div className="ml-auto inline-flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setView("code")}
                  className={`px-3 py-1.5 text-sm inline-flex items-center gap-1 ${
                    view === "code" ? "bg-slate-900 text-white" : "bg-white text-slate-600"
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" /> HTML
                </button>
                <button
                  onClick={() => setView("preview")}
                  className={`px-3 py-1.5 text-sm inline-flex items-center gap-1 ${
                    view === "preview" ? "bg-slate-900 text-white" : "bg-white text-slate-600"
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" /> Pré-visualizar
                </button>
              </div>
            </div>

            {view === "code" ? (
              <textarea
                value={draft.html}
                onChange={(e) => setDraft({ ...draft, html: e.target.value })}
                rows={18}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
              />
            ) : (
              <div className="space-y-2">
                {draft.variaveis.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    {draft.variaveis.map((v) => (
                      <div key={v}>
                        <label className="text-[11px] text-slate-500 font-mono">{v}</label>
                        <input
                          value={previewVars[v] ?? ""}
                          onChange={(e) => setPreviewVars({ ...previewVars, [v]: e.target.value })}
                          className="mt-0.5 w-full px-2 py-1 text-xs rounded border border-slate-200"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <iframe
                  title="preview"
                  srcDoc={previewHtml}
                  className="w-full h-[480px] rounded-lg border border-slate-200 bg-white"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={handleDelete}
                disabled={!draft.id}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Selecione um template ou clique em <strong>Novo</strong>.
          </section>
        )}
      </div>
    </div>
  );
}
