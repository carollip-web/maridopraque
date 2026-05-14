import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, RefreshCw } from "lucide-react";

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
    out[k] = v;
  }
  return out;
}

export function AdminAuditoria() {
  const [filterAction, setFilterAction] = useState("");
  const [filterActor, setFilterActor] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const {
    data: rows,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["admin-audit-log", filterAction, filterActor, filterDate],
    queryFn: async () => {
      let q = supabase
        .from("admin_audit_log")
        .select("id, created_at, actor_user_id, action, target_user_id, details")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filterAction.trim()) q = q.ilike("action", `%${filterAction.trim()}%`);
      if (filterActor.trim()) q = q.eq("actor_user_id", filterActor.trim());
      if (filterDate) {
        const start = new Date(filterDate + "T00:00:00").toISOString();
        const end = new Date(filterDate + "T23:59:59.999").toISOString();
        q = q.gte("created_at", start).lte("created_at", end);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-brand" /> Auditoria administrativa
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Últimos 100 eventos registrados em <code>admin_audit_log</code>. Somente leitura.
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
          <Label htmlFor="f-action" className="text-xs">Ação contém</Label>
          <Input
            id="f-action"
            placeholder="ex: impersonate"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-actor" className="text-xs">Actor user_id (UUID exato)</Label>
          <Input
            id="f-actor"
            placeholder="00000000-0000-..."
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-date" className="text-xs">Data</Label>
          <Input
            id="f-date"
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
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
                  const hasDetails = Object.keys(safe).length > 0;
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
                        {hasDetails ? (
                          <pre className="text-[11px] text-slate-600 bg-slate-50 rounded p-2 max-w-md overflow-x-auto whitespace-pre-wrap break-words">
                            {JSON.stringify(safe, null, 2)}
                          </pre>
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
      </div>
    </div>
  );
}
