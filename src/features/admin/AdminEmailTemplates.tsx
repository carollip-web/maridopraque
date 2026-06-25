import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Plus, Save, Trash2, Eye, Code2, RefreshCw, CheckCircle2, Wand2 } from "lucide-react";

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

type SimpleData = {
  titulo: string;
  intro: string;
  mensagem: string;
  cta_texto: string;
  cta_url: string;
  assinatura: string;
};

const EMPTY_SIMPLE: SimpleData = {
  titulo: "{{assunto}}",
  intro: "Olá {{nome}},",
  mensagem: "{{mensagem}}",
  cta_texto: "",
  cta_url: "",
  assinatura: "Equipe Marido pra Quê",
};

const MARKER_START = "<!--SIMPLE:";
const MARKER_END = "-->";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtmlFromSimple(s: SimpleData): string {
  const marker = `${MARKER_START}${btoa(unescape(encodeURIComponent(JSON.stringify(s))))}${MARKER_END}`;
  const titulo = escapeHtml(s.titulo);
  const intro = escapeHtml(s.intro).replace(/\n/g, "<br/>");
  const mensagem = escapeHtml(s.mensagem).replace(/\n/g, "<br/>");
  const assinatura = escapeHtml(s.assinatura).replace(/\n/g, "<br/>");
  const cta =
    s.cta_texto && s.cta_url
      ? `<p style="margin:24px 0 8px"><a href="${escapeHtml(s.cta_url)}" style="display:inline-block;background:#FF6B35;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(s.cta_texto)}</a></p>`
      : "";
  return `${marker}
<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.06)">
      <tr><td style="background:#FF6B35;padding:18px 24px;color:#fff;font-weight:700;font-size:16px">Marido pra Quê?</td></tr>
      <tr><td style="padding:28px 24px">
        <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3">${titulo}</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155">${intro}</p>
        <div style="font-size:15px;line-height:1.6;color:#334155">${mensagem}</div>
        ${cta}
      </td></tr>
      <tr><td style="padding:18px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">${assinatura} · contato@maridopraque.com</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function parseSimpleFromHtml(html: string): SimpleData | null {
  const i = html.indexOf(MARKER_START);
  if (i === -1) return null;
  const j = html.indexOf(MARKER_END, i);
  if (j === -1) return null;
  const b64 = html.slice(i + MARKER_START.length, j);
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json) as SimpleData;
  } catch {
    return null;
  }
}

function renderPreview(html: string, vars: Record<string, string>): string {
  let out = html;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{{${k}}}`, v);
  return out.replace(/\{\{[^}]+\}\}/g, "");
}

const EMPTY: Template = {
  id: "",
  slug: "",
  nome: "",
  descricao: "",
  assunto: "",
  html: buildHtmlFromSimple(EMPTY_SIMPLE),
  variaveis: ["nome", "assunto", "mensagem"],
  ativo: true,
  updated_at: "",
};

export function AdminEmailTemplates() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Template | null>(null);
  const [simple, setSimple] = useState<SimpleData | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"simples" | "code" | "preview">("simples");
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

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId) { setDraft(null); setSimple(null); return; }
    const found = items.find((t) => t.id === selectedId) ?? null;
    if (!found) { setDraft(null); setSimple(null); return; }
    setDraft({ ...found });
    const parsed = parseSimpleFromHtml(found.html);
    setSimple(parsed);
    setView(parsed ? "simples" : "code");
    const defaults: Record<string, string> = {};
    for (const v of found.variaveis) defaults[v] = `[${v}]`;
    setPreviewVars(defaults);
  }, [selectedId, items]);

  const updateSimple = (patch: Partial<SimpleData>) => {
    if (!draft || !simple) return;
    const next = { ...simple, ...patch };
    setSimple(next);
    setDraft({ ...draft, html: buildHtmlFromSimple(next) });
  };

  const handleNew = () => {
    setSelectedId(null);
    setDraft({ ...EMPTY });
    setSimple({ ...EMPTY_SIMPLE });
    setView("simples");
  };

  const convertToSimple = () => {
    if (!draft) return;
    const novo = { ...EMPTY_SIMPLE, titulo: draft.assunto || "{{assunto}}" };
    setSimple(novo);
    setDraft({ ...draft, html: buildHtmlFromSimple(novo) });
    setView("simples");
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.slug.trim() || !draft.nome.trim() || !draft.assunto.trim() || !draft.html.trim()) {
      setError("Preencha nome, slug, assunto e conteúdo.");
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
    if (error) { setError(error.message); return; }
    await load();
    if (data?.id) setSelectedId(data.id);
  };

  const handleDelete = async () => {
    if (!draft?.id) return;
    if (!confirm(`Excluir template "${draft.nome}"?`)) return;
    const { error } = await (supabase as any).from("email_templates").delete().eq("id", draft.id);
    if (error) { setError(error.message); return; }
    setSelectedId(null); setDraft(null); load();
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
          <p className="text-sm text-slate-500">Edite no modo <strong>Simples</strong> — sem precisar saber HTML.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          <button onClick={handleNew} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500 text-white text-sm hover:bg-orange-600">
            <Plus className="h-4 w-4" /> Novo
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
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
                    className={`w-full text-left px-3 py-3 hover:bg-slate-50 transition ${selectedId === t.id ? "bg-orange-50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900 text-sm truncate">{t.nome}</span>
                      {t.ativo ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <span className="text-[10px] text-slate-400 uppercase">off</span>}
                    </div>
                    <div className="text-xs text-slate-500 font-mono truncate">{t.slug}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {draft ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Nome</label>
                <input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Ex: Boas-vindas" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Slug (id único)</label>
                <input value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_") })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono" placeholder="ex: boas_vindas" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Descrição (opcional)</label>
              <input value={draft.descricao ?? ""} onChange={(e) => setDraft({ ...draft, descricao: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Quando este template é usado?" />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Assunto do e-mail</label>
              <input value={draft.assunto} onChange={(e) => setDraft({ ...draft, assunto: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                placeholder="Ex: Bem-vindo ao Marido pra Quê!" />
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={draft.ativo} onChange={(e) => setDraft({ ...draft, ativo: e.target.checked })} />
                Template ativo
              </label>
              <div className="ml-auto inline-flex rounded-lg border border-slate-200 overflow-hidden">
                <button onClick={() => setView("simples")}
                  className={`px-3 py-1.5 text-sm inline-flex items-center gap-1 ${view === "simples" ? "bg-orange-500 text-white" : "bg-white text-slate-600"}`}>
                  <Wand2 className="h-3.5 w-3.5" /> Simples
                </button>
                <button onClick={() => setView("preview")}
                  className={`px-3 py-1.5 text-sm inline-flex items-center gap-1 ${view === "preview" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>
                  <Eye className="h-3.5 w-3.5" /> Pré-visualizar
                </button>
                <button onClick={() => setView("code")}
                  className={`px-3 py-1.5 text-sm inline-flex items-center gap-1 ${view === "code" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>
                  <Code2 className="h-3.5 w-3.5" /> HTML
                </button>
              </div>
            </div>

            {view === "simples" && (
              simple ? (
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-500">
                    Preencha os campos abaixo. Use <code className="bg-white px-1 rounded">{`{{nome}}`}</code>, <code className="bg-white px-1 rounded">{`{{mensagem}}`}</code> ou <code className="bg-white px-1 rounded">{`{{assunto}}`}</code> onde quiser que o sistema substitua pelos dados reais.
                  </p>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Título (aparece grande no topo)</label>
                    <input value={simple.titulo} onChange={(e) => updateSimple({ titulo: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Saudação</label>
                    <input value={simple.intro} onChange={(e) => updateSimple({ intro: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                      placeholder="Olá {{nome}}," />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Mensagem principal</label>
                    <textarea value={simple.mensagem} onChange={(e) => updateSimple({ mensagem: e.target.value })} rows={7}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                      placeholder="Escreva sua mensagem aqui. Quebras de linha são preservadas." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700">Botão — Texto (opcional)</label>
                      <input value={simple.cta_texto} onChange={(e) => updateSimple({ cta_texto: e.target.value })}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                        placeholder="Ex: Acessar minha conta" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">Botão — Link (URL)</label>
                      <input value={simple.cta_url} onChange={(e) => updateSimple({ cta_url: e.target.value })}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                        placeholder="https://..." />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Assinatura no rodapé</label>
                    <input value={simple.assinatura} onChange={(e) => updateSimple({ assinatura: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white" />
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 space-y-2">
                  <p>Este template foi criado em HTML personalizado e não pode ser editado no modo simples sem perder o layout atual.</p>
                  <button onClick={convertToSimple}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs hover:bg-amber-700">
                    <Wand2 className="h-3.5 w-3.5" /> Converter para modo simples (substitui o HTML)
                  </button>
                </div>
              )
            )}

            {view === "code" && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Modo avançado — edite o HTML diretamente. Se você editar aqui, perderá o modo Simples.</p>
                <textarea value={draft.html}
                  onChange={(e) => { setDraft({ ...draft, html: e.target.value }); setSimple(parseSimpleFromHtml(e.target.value)); }}
                  rows={18} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono" />
              </div>
            )}

            {view === "preview" && (
              <div className="space-y-2">
                {draft.variaveis.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    {draft.variaveis.map((v) => (
                      <div key={v}>
                        <label className="text-[11px] text-slate-500 font-mono">{v}</label>
                        <input value={previewVars[v] ?? ""}
                          onChange={(e) => setPreviewVars({ ...previewVars, [v]: e.target.value })}
                          className="mt-0.5 w-full px-2 py-1 text-xs rounded border border-slate-200" />
                      </div>
                    ))}
                  </div>
                )}
                <iframe title="preview" srcDoc={previewHtml}
                  className="w-full h-[480px] rounded-lg border border-slate-200 bg-white" />
              </div>
            )}

            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer">Variáveis disponíveis</summary>
              <input
                value={draft.variaveis.join(", ")}
                onChange={(e) => setDraft({ ...draft, variaveis: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono"
                placeholder="nome, assunto, mensagem" />
            </details>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button onClick={handleDelete} disabled={!draft.id}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30">
                <Trash2 className="h-4 w-4" /> Excluir
              </button>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
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
