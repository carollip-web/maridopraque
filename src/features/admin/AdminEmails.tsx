import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Search, RefreshCw, CheckCircle2, XCircle, Clock, Ban, ExternalLink, FileText, Inbox } from "lucide-react";
import { AdminEmailTemplates } from "./AdminEmailTemplates";

type LogRow = {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const RANGES = [
  { id: "24h", label: "Últimas 24h", hours: 24 },
  { id: "7d", label: "7 dias", hours: 24 * 7 },
  { id: "30d", label: "30 dias", hours: 24 * 30 },
  { id: "all", label: "Tudo", hours: null as number | null },
];

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  sent: { label: "Enviado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  pending: { label: "Pendente", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  dlq: { label: "Falhou", cls: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  failed: { label: "Falhou", cls: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  bounced: { label: "Devolvido", cls: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  complained: { label: "Reclamação", cls: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  suppressed: { label: "Suprimido", cls: "bg-slate-100 text-slate-600 border-slate-200", icon: Ban },
};

function StatusBadge({ status }: { status: string | null }) {
  const meta = STATUS_META[status ?? ""] ?? {
    label: status ?? "—",
    cls: "bg-slate-100 text-slate-600 border-slate-200",
    icon: Clock,
  };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${meta.cls}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

export function AdminEmails() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState("7d");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = async () => {
    setLoading(true);
    setError(null);
    const range_cfg = RANGES.find((r) => r.id === range);
    let q = supabase
      .from("email_send_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (range_cfg?.hours) {
      const since = new Date(Date.now() - range_cfg.hours * 3600_000).toISOString();
      q = q.gte("created_at", since);
    }
    const { data, error } = await q;
    if (error) setError(error.message);
    setRows((data ?? []) as LogRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // Deduplicate by message_id keeping latest status
  const deduped = useMemo(() => {
    const map = new Map<string, LogRow>();
    for (const r of rows) {
      const key = r.message_id ?? r.id;
      const existing = map.get(key);
      if (!existing || new Date(r.created_at) > new Date(existing.created_at)) {
        map.set(key, r);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [rows]);

  const templates = useMemo(() => {
    const s = new Set<string>();
    deduped.forEach((r) => r.template_name && s.add(r.template_name));
    return Array.from(s).sort();
  }, [deduped]);

  const filtered = useMemo(() => {
    return deduped.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (templateFilter !== "all" && r.template_name !== templateFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${r.recipient_email ?? ""} ${r.template_name ?? ""} ${r.error_message ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [deduped, statusFilter, templateFilter, query]);

  const stats = useMemo(() => {
    const s = { total: filtered.length, sent: 0, failed: 0, suppressed: 0, pending: 0 };
    for (const r of filtered) {
      if (r.status === "sent") s.sent++;
      else if (r.status === "suppressed") s.suppressed++;
      else if (r.status === "pending") s.pending++;
      else if (r.status) s.failed++;
    }
    return s;
  }, [filtered]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const getLink = (r: LogRow): string | null => {
    const m = r.metadata as Record<string, unknown> | null;
    if (!m) return null;
    const candidates = [m.link, m.url, m.notification_link, m.action_url];
    for (const c of candidates) if (typeof c === "string" && c) return c;
    return null;
  };
  const getEvento = (r: LogRow): string => {
    const m = r.metadata as Record<string, unknown> | null;
    if (m && typeof m.evento === "string") return m.evento;
    if (m && typeof m.tipo === "string") return m.tipo;
    return r.template_name ?? "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Mail className="h-6 w-6 text-brand" /> E-mails
          </h1>
          <p className="text-sm text-slate-500">Histórico de envios via Gmail (contato@maridopraque.com).</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, cls: "text-slate-900" },
          { label: "Enviados", value: stats.sent, cls: "text-emerald-600" },
          { label: "Falharam", value: stats.failed, cls: "text-red-600" },
          { label: "Suprimidos", value: stats.suppressed, cls: "text-slate-500" },
          { label: "Pendentes", value: stats.pending, cls: "text-amber-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                range === r.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="all">Todos os status</option>
          <option value="sent">Enviados</option>
          <option value="dlq">Falhou (DLQ)</option>
          <option value="failed">Falhou</option>
          <option value="suppressed">Suprimido</option>
          <option value="pending">Pendente</option>
          <option value="bounced">Devolvido</option>
        </select>

        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="all">Todos os templates</option>
          {templates.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <div className="flex-1 min-w-[200px] relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por destinatário, evento ou erro..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Destinatário</th>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Carregando...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Nenhum envio encontrado.
                  </td>
                </tr>
              ) : (
                paginated.map((r) => {
                  const link = getLink(r);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-medium">{r.recipient_email ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{getEvento(r)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                        {r.error_message && (
                          <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={r.error_message}>
                            {r.error_message}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-brand hover:underline text-xs"
                          >
                            Abrir <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm">
            <span className="text-slate-500">
              Página {page + 1} de {totalPages} · {filtered.length} envios
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-md border border-slate-200 bg-white disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-md border border-slate-200 bg-white disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
