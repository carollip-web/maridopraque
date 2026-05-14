import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ShieldCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface AuditRow {
  id: string;
  created_at: string;
  actor_user_id: string;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown> | null;
}

interface ProfileLite {
  id: string;
  nome: string | null;
  email: string | null;
}

const PAGE_SIZE = 50;

const KNOWN_ACTIONS = [
  "impersonate_user",
  "create_professional",
  "delete_professional",
  "reset_test_data",
  "seed_test_data",
] as const;

const FORBIDDEN_KEYS = [
  "password",
  "senha",
  "token",
  "secret",
  "service_role",
  "apikey",
  "api_key",
  "authorization",
  "bearer",
  "access_token",
  "refresh_token",
];

function sanitizeDetails(d: unknown): Record<string, unknown> {
  if (!d || typeof d !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.some((f) => k.toLowerCase().includes(f))) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeDetails(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

export function AdminAuditoria() {
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterActor, setFilterActor] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [page, setPage] = useState(0);

  const queryKey = [
    "admin-audit-log",
    filterAction,
    filterActor,
    filterDate,
    page,
  ];

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("admin_audit_log")
        .select(
          "id, created_at, actor_user_id, action, target_user_id, details",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);
      if (filterAction !== "all") q = q.eq("action", filterAction);
      if (filterActor.trim()) q = q.eq("actor_user_id", filterActor.trim());
      if (filterDate) {
        const start = new Date(filterDate + "T00:00:00").toISOString();
        const end = new Date(filterDate + "T23:59:59.999").toISOString();
        q = q.gte("created_at", start).lte("created_at", end);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as AuditRow[], count: count ?? 0 };
    },
  });

  const rows = data?.rows;
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const userIds = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r) => {
      if (r.actor_user_id) set.add(r.actor_user_id);
      if (r.target_user_id) set.add(r.target_user_id);
    });
    return Array.from(set);
  }, [rows]);

  const { data: profilesById } = useQuery({
    queryKey: ["admin-audit-profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);
      if (error) throw error;
      const map = new Map<string, ProfileLite>();
      (data ?? []).forEach((p) => map.set(p.id, p as ProfileLite));
      return map;
    },
  });

  const fmtUser = (id: string | null) => {
    if (!id) return "—";
    const p = profilesById?.get(id);
    if (!p) return id.slice(0, 8) + "…";
    return p.nome || p.email || id.slice(0, 8) + "…";
  };

  const resetPage = () => setPage(0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-brand" /> Auditoria administrativa
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Eventos registrados em <code>admin_audit_log</code>. Somente leitura.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="f-action" className="text-xs">Ação</Label>
          <Select
            value={filterAction}
            onValueChange={(v) => {
              setFilterAction(v);
              resetPage();
            }}
          >
            <SelectTrigger id="f-action">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {KNOWN_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-actor" className="text-xs">Actor user_id (UUID exato)</Label>
          <Input
            id="f-actor"
            placeholder="00000000-0000-..."
            value={filterActor}
            onChange={(e) => {
              setFilterActor(e.target.value);
              resetPage();
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-date" className="text-xs">Data</Label>
          <Input
            id="f-date"
            type="date"
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              resetPage();
            }}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 grid place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">
            Erro ao carregar auditoria: {(error as Error).message}
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Nenhum evento encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Data/hora</th>
                  <th className="text-left px-4 py-3 font-semibold">Ação</th>
                  <th className="text-left px-4 py-3 font-semibold">Actor</th>
                  <th className="text-left px-4 py-3 font-semibold">Alvo</th>
                  <th className="text-left px-4 py-3 font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const safe = sanitizeDetails(r.details);
                  const entries = Object.entries(safe);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 align-top">
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                          {r.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{fmtUser(r.actor_user_id)}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {r.actor_user_id}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.target_user_id ? (
                          <>
                            <div className="text-slate-700">{fmtUser(r.target_user_id)}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {r.target_user_id}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {entries.length > 0 ? (
                          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs max-w-md">
                            {entries.map(([k, v]) => (
                              <div key={k} className="contents">
                                <dt className="text-slate-500 font-medium">{k}</dt>
                                <dd className="text-slate-700 break-words">
                                  {formatValue(v)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
            <div>
              Mostrando {page * PAGE_SIZE + 1}–
              {Math.min((page + 1) * PAGE_SIZE, total)} de {total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </Button>
              <span className="px-2">
                Página {page + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page + 1 >= totalPages || isFetching}
              >
                Próxima <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
