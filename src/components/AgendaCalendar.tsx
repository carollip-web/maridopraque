import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from "lucide-react";
import { DIAS_SEMANA } from "@/lib/agenda";

type Janela = { dia_semana: number; hora_inicio: string; hora_fim: string };
type Bloqueio = { data_inicio: string; data_fim: string; motivo: string | null };
type Agendamento = {
  id: string;
  service_name: string;
  data_agendada: string;
  status: string;
  duracao_min: number;
};
type ReservaAgenda = {
  id: string;
  orcamento_id: string | null;
  inicio: string;
  fim: string;
  status: string;
  motivo: string | null;
  expires_at: string | null;
};

const HOUR_START = 7;
const HOUR_END = 21;
const PX_PER_HOUR = 44;

function startOfWeek(d: Date) {
  const x = new Date(d);
  const dow = x.getDay(); // 0 = dom
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - dow);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function hourToY(h: number, m: number) {
  return (h - HOUR_START + m / 60) * PX_PER_HOUR;
}

function timeStrToMinutes(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

export function AgendaCalendar() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [janelas, setJanelas] = useState<Janela[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [reservas, setReservas] = useState<ReservaAgenda[]>([]);
  const [duracao, setDuracao] = useState(60);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i),
    [],
  );

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data: jans }, { data: blocs }, { data: ags }, { data: perfil }, pbaRes] =
        await Promise.all([
          supabase
            .from("profissional_disponibilidade")
            .select("dia_semana,hora_inicio,hora_fim")
            .eq("user_id", user.id),
          supabase
            .from("profissional_bloqueios")
            .select("data_inicio,data_fim,motivo")
            .eq("user_id", user.id)
            .lt("data_inicio", weekEnd.toISOString())
            .gt("data_fim", weekStart.toISOString()),
          supabase
            .from("orcamentos")
            .select("id,service_name,data_agendada,status")
            .eq("profissional_id", user.id)
            .not("data_agendada", "is", null)
            .gte("data_agendada", weekStart.toISOString())
            .lt("data_agendada", weekEnd.toISOString()),
          supabase
            .from("profissional_perfil")
            .select("duracao_padrao_min")
            .eq("user_id", user.id)
            .maybeSingle(),
          (supabase as any)
            .from("profissional_bloqueios_agenda")
            .select("id,orcamento_id,inicio,fim,status,motivo,expires_at")
            .eq("profissional_id", user.id)
            .in("status", ["temporario", "confirmado"])
            .lt("inicio", weekEnd.toISOString())
            .gt("fim", weekStart.toISOString()),
        ]);
      if (!alive) return;
      if (pbaRes.error) {
        console.warn("[AgendaCalendar] bloqueios_agenda indisponíveis", pbaRes.error);
      }
      const now = new Date();
      const reservasValidas = ((pbaRes.data as ReservaAgenda[]) || []).filter((r) => {
        if (r.status !== "temporario") return true;
        if (!r.expires_at) return true;
        return new Date(r.expires_at) > now;
      });
      console.info("[AgendaCalendar] semana visível e reservas", {
        inicioSemana: weekStart.toISOString(),
        fimSemana: weekEnd.toISOString(),
        reservas: reservasValidas,
      });
      setJanelas((jans as Janela[]) ?? []);
      setBloqueios((blocs as Bloqueio[]) ?? []);
      setReservas(reservasValidas);
      const dur = perfil?.duracao_padrao_min ?? 60;
      setDuracao(dur);
      setAgendamentos(((ags as any[]) ?? []).map((a) => ({ ...a, duracao_min: dur })));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user?.id, weekStart, weekEnd]);

  const totalHeight = (HOUR_END - HOUR_START) * PX_PER_HOUR;
  const isToday = (d: Date) => {
    const t = new Date();
    return d.toDateString() === t.toDateString();
  };

  return (
    <section className="rounded-3xl bg-white border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-bold text-slate-900">Visão semanal</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full h-8 px-3"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium text-slate-700 min-w-[140px] text-center">
            {fmtDay(weekStart)} – {fmtDay(addDays(weekEnd, -1))}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full h-8 px-3"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-8 text-xs"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
          >
            Hoje
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-500 mb-2">
        <span className="flex items-center gap-1">
          <i className="h-2 w-2 rounded-sm bg-emerald-200" /> Disponível
        </span>
        <span className="flex items-center gap-1">
          <i className="h-2 w-2 rounded-sm bg-rose-300" /> Bloqueio
        </span>
        <span className="flex items-center gap-1">
          <i className="h-2 w-2 rounded-sm bg-brand" /> Agendamento
        </span>
        <span className="flex items-center gap-1">
          <i className="h-2 w-2 rounded-sm bg-amber-400" /> Reserva pendente
        </span>
        <span className="flex items-center gap-1">
          <i className="h-2 w-2 rounded-sm bg-emerald-500" /> Confirmado
        </span>
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="min-w-[720px] grid"
            style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}
          >
            {/* Header */}
            <div />
            {days.map((d, i) => (
              <div
                key={i}
                className={`text-center text-xs font-bold uppercase tracking-wider py-2 border-b border-slate-200 ${isToday(d) ? "text-brand" : "text-slate-600"}`}
              >
                <div>{DIAS_SEMANA[i]}</div>
                <div
                  className={`text-[10px] font-medium ${isToday(d) ? "text-brand" : "text-slate-400"}`}
                >
                  {fmtDay(d)}
                </div>
              </div>
            ))}

            {/* Hour gutter */}
            <div className="relative" style={{ height: totalHeight }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 -translate-y-1/2 text-[10px] text-slate-400 text-right pr-1"
                  style={{ top: hourToY(h, 0) }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((d, i) => {
              const dow = d.getDay();
              const dayJanelas = janelas.filter((j) => j.dia_semana === dow);
              const dayStart = new Date(d);
              dayStart.setHours(0, 0, 0, 0);
              const dayEnd = addDays(dayStart, 1);

              return (
                <div
                  key={i}
                  className="relative border-l border-slate-100"
                  style={{ height: totalHeight }}
                >
                  {/* Hour grid lines */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-slate-100"
                      style={{ top: hourToY(h, 0) }}
                    />
                  ))}

                  {/* Disponibilidade */}
                  {dayJanelas.map((j, k) => {
                    const startMin = timeStrToMinutes(j.hora_inicio);
                    const endMin = timeStrToMinutes(j.hora_fim);
                    const top = (startMin / 60 - HOUR_START) * PX_PER_HOUR;
                    const height = ((endMin - startMin) / 60) * PX_PER_HOUR;
                    return (
                      <div
                        key={k}
                        className="absolute left-0.5 right-0.5 bg-emerald-100/70 border-l-2 border-emerald-400 rounded-md"
                        style={{ top, height }}
                      />
                    );
                  })}

                  {/* Bloqueios que tocam este dia */}
                  {bloqueios.map((b, k) => {
                    const bIni = new Date(b.data_inicio);
                    const bFim = new Date(b.data_fim);
                    if (bFim <= dayStart || bIni >= dayEnd) return null;
                    const start = bIni < dayStart ? dayStart : bIni;
                    const end = bFim > dayEnd ? dayEnd : bFim;
                    const startMin = start.getHours() * 60 + start.getMinutes();
                    const endMin =
                      end.getHours() * 60 +
                      end.getMinutes() +
                      (end.getDate() !== start.getDate() ? 24 * 60 : 0);
                    const top = Math.max(0, (startMin / 60 - HOUR_START) * PX_PER_HOUR);
                    const height = Math.max(8, ((endMin - startMin) / 60) * PX_PER_HOUR);
                    return (
                      <div
                        key={k}
                        className="absolute left-0.5 right-0.5 bg-rose-200/80 border border-rose-400 rounded-md text-[10px] text-rose-900 px-1 overflow-hidden"
                        style={{ top, height }}
                        title={b.motivo ?? "Bloqueio"}
                      >
                        {b.motivo ?? "Bloqueio"}
                      </div>
                    );
                  })}

                  {/* Agendamentos */}
                  {agendamentos
                    .filter((a) => {
                      const dt = new Date(a.data_agendada);
                      return dt >= dayStart && dt < dayEnd;
                    })
                    .map((a) => {
                      const dt = new Date(a.data_agendada);
                      const startMin = dt.getHours() * 60 + dt.getMinutes();
                      const top = (startMin / 60 - HOUR_START) * PX_PER_HOUR;
                      const height = (duracao / 60) * PX_PER_HOUR;
                      return (
                        <div
                          key={a.id}
                          className="absolute left-1 right-1 bg-brand text-white rounded-md px-1.5 py-1 shadow-sm overflow-hidden"
                          style={{ top, height, minHeight: 28 }}
                          title={`${a.service_name} • ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                        >
                          <p className="text-[10px] font-bold leading-tight truncate">
                            {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <p className="text-[10px] leading-tight truncate opacity-90">
                            {a.service_name}
                          </p>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
