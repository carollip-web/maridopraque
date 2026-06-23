import React from "react";
import {
  Clock,
  Pencil,
  TrendingUp,
  DollarSign,
  CalendarClock,
  Star,
  Wallet,
  Settings,
} from "lucide-react";
import { ProfileCompletenessCard } from "@/components/ProfileCompletenessCard";
import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";
import { NivelBadge } from "@/components/NivelBadge";
import { ProfissionalChart } from "@/components/ProfissionalChart";
import { ProfissionalHeader } from "./ProfissionalHeader";
import { type Tables } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";

import { ActionStat, QuickLink } from "./ProfissionalStats";
import { Orcamento, ProfissionalTab } from "./types";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, BadgeCheck, HeartHandshake } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // segunda = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function fmtLabel(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

type ProximoServico = {
  id: string;
  service_name: string;
  data_agendada: string | null;
  tipo_atendimento: string | null;
  cliente_id: string | null;
  status: string;
  clienteNome?: string | null;
};

async function carregarNomeCliente(clienteId?: string | null) {
  if (!clienteId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", clienteId)
    .maybeSingle();
  return data?.nome ?? null;
}

function ProximoServicoCard({
  userId,
  orcamentos,
}: {
  userId?: string;
  orcamentos: Orcamento[];
}) {
  const proxLocal = React.useMemo<ProximoServico | null>(() => {
    const now = Date.now();
    const proximo = orcamentos
      .filter(
        (o) =>
          (o.profissional_id === userId ||
            (o as Orcamento & { apoio_profissional_id?: string | null })
              .apoio_profissional_id === userId) &&
          ["aprovado", "pago"].includes(o.status) &&
          !!o.data_agendada &&
          new Date(o.data_agendada).getTime() >= now,
      )
      .sort(
        (a, b) =>
          new Date(a.data_agendada!).getTime() -
          new Date(b.data_agendada!).getTime(),
      )[0];

    if (!proximo) return null;
    return {
      id: proximo.id,
      service_name: proximo.service_name,
      data_agendada: proximo.data_agendada ?? null,
      tipo_atendimento: proximo.tipo_atendimento ?? null,
      cliente_id: proximo.cliente_id,
      status: proximo.status,
    };
  }, [orcamentos, userId]);

  const { data: proxRemoto, isLoading } = useQuery({
    queryKey: ["profissional", "proximo-servico", userId],
    enabled: !!userId && !proxLocal,
    queryFn: async (): Promise<ProximoServico | null> => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("orcamentos")
        .select(
          "id, service_name, data_agendada, tipo_atendimento, cliente_id, status",
        )
        .or(`profissional_id.eq.${userId},apoio_profissional_id.eq.${userId}`)
        .in("status", ["aprovado", "pago"])
        .not("data_agendada", "is", null)
        .gte("data_agendada", now)
        .order("data_agendada", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        return {
          ...data,
          clienteNome: await carregarNomeCliente(data.cliente_id),
        };
      }

      const { data: reserva, error: reservaError } = await supabase
        .from("profissional_bloqueios_agenda")
        .select("orcamento_id, inicio, status")
        .eq("profissional_id", userId!)
        .eq("status", "confirmado")
        .gte("inicio", now)
        .order("inicio", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (reservaError) throw reservaError;
      if (!reserva?.orcamento_id) return null;

      const { data: orcamento, error: orcamentoError } = await supabase
        .from("orcamentos")
        .select(
          "id, service_name, data_agendada, tipo_atendimento, cliente_id, status",
        )
        .eq("id", reserva.orcamento_id)
        .maybeSingle();

      if (orcamentoError) throw orcamentoError;
      if (!orcamento) return null;

      return {
        ...orcamento,
        data_agendada: orcamento.data_agendada ?? reserva.inicio,
        clienteNome: await carregarNomeCliente(orcamento.cliente_id),
      };
    },
  });

  const prox = proxLocal ?? proxRemoto;

  if (!proxLocal && isLoading) {
    return <Skeleton className="h-24 w-full rounded-2xl" />;
  }

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-indigo-50 to-blue-50 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock className="h-5 w-5 text-indigo-600" />
        <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-widest">
          Próximo Serviço
        </h3>
      </div>
      {prox ? (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-slate-900">{prox.service_name}</p>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-600">
              <span className="font-medium text-brand">
                📅{" "}
                {new Date(prox.data_agendada!).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
              <span>👤 {prox.clienteNome || "Cliente"}</span>
            </div>
          </div>
          {prox.tipo_atendimento === "homem_com_apoio_feminino" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-pink-100 text-pink-700 border border-pink-200">
              <HeartHandshake className="h-3.5 w-3.5" />
              Apoio Feminino
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-indigo-700 font-medium">Nenhum serviço agendado no momento.</p>
      )}
    </div>
  );
}

function PrimeirosPassosCard({
  userId,
  setTab,
  metrics,
  counts,
}: {
  userId?: string,
  setTab: any,
  metrics: any,
  counts: ProfissionalDashboardProps["counts"],
}) {
  const recebeuPrimeiroPedido =
    metrics.totalConcluidos > 0 ||
    counts.oportunidades + counts.elaboracao + counts.enviados + counts.ativos + counts.finalizados > 0;

  const { data, isLoading } = useQuery({
    queryKey: ["profissional", "primeiros-passos-check", userId],
    enabled: !!userId && !recebeuPrimeiroPedido,
    queryFn: async () => {
      const { data: perfil } = await supabase
        .from("profissional_perfil")
        .select("bio, foto_url, especialidades, mp_user_id, cpf")
        .eq("user_id", userId!)
        .maybeSingle();
      
      const { data: p } = await supabase
        .from("profiles")
        .select("nome, whatsapp")
        .eq("id", userId!)
        .maybeSingle();
      
      const isComplete = !!(
        p?.nome && p?.whatsapp && perfil?.foto_url && 
        perfil?.bio && perfil?.cpf && 
        perfil?.especialidades && perfil.especialidades.length > 0
      );

      const { data: agendas } = await supabase
        .from("profissional_disponibilidade")
        .select("id")
        .eq("user_id", userId!)
        .limit(1);

      return {
        isComplete,
        mp: !!perfil?.mp_user_id,
        agenda: agendas && agendas.length > 0
      };
    }
  });

  if (recebeuPrimeiroPedido) return null;
  if (!data?.isComplete) return null;

  return (
    <div className="rounded-3xl border border-brand/20 bg-brand/5 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <BadgeCheck className="h-6 w-6 text-brand" />
        <h3 className="font-bold text-lg text-slate-900">Primeiros passos</h3>
      </div>
      <ul className="space-y-3">
        <li className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-slate-500 line-through">Perfil completo</span>
        </li>
        <li className="flex items-center gap-2 text-sm">
          {data.mp ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <Circle className="h-4 w-4 text-slate-300 shrink-0" />}
          {data.mp ? (
            <span className="text-slate-500 line-through">Conectar Mercado Pago</span>
          ) : (
            <span>Conectar Mercado Pago (<button onClick={() => setTab("configuracoes")} className="text-brand font-bold hover:underline">configurar</button>)</span>
          )}
        </li>
        <li className="flex items-center gap-2 text-sm">
          {data.agenda ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <Circle className="h-4 w-4 text-slate-300 shrink-0" />}
          {data.agenda ? (
            <span className="text-slate-500 line-through">Configurar agenda</span>
          ) : (
            <span>Configurar agenda (<button onClick={() => setTab("agenda")} className="text-brand font-bold hover:underline">configurar</button>)</span>
          )}
        </li>
        <li className="flex items-start gap-2 text-sm mt-2">
          <Circle className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
          <span className="text-slate-700 font-medium">
            Aguardar primeiro pedido
            <span className="block text-xs text-muted-foreground mt-0.5 font-normal">Quando um cliente solicitar um serviço na sua área, você será notificado aqui.</span>
          </span>
        </li>
      </ul>
    </div>
  );
}

function ProfissionalEarningsChart({ userId }: { userId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["profissional", "earnings-chart", userId],
    enabled: !!userId,
    queryFn: async () => {
      const WEEKS = 8;
      const now = new Date();
      const weeks: { start: Date; end: Date; label: string; ganhos: number }[] = [];
      const base = startOfWeek(now);
      
      for (let i = WEEKS - 1; i >= 0; i--) {
        const start = new Date(base);
        start.setDate(start.getDate() - i * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        weeks.push({ start, end, label: fmtLabel(start), ganhos: 0 });
      }

      const startDate = weeks[0].start;

      const { data: splits } = await supabase
        .from("pagamento_splits")
        .select("valor_profissional, created_at, status")
        .eq("profissional_id", userId!)
        .gte("created_at", startDate.toISOString());

      if (splits) {
        splits.forEach(s => {
          if (["aguardando_conclusao", "disponivel", "solicitado", "pago", "approved", "paid"].includes(String(s.status))) {
            const t = new Date(s.created_at).getTime();
            const w = weeks.find(wk => t >= wk.start.getTime() && t < wk.end.getTime());
            if (w) {
              w.ganhos += Number(s.valor_profissional || 0);
            }
          }
        });
      }

      return weeks.map(w => ({
        semana: w.label,
        ganhos: Number(w.ganhos.toFixed(2))
      }));
    }
  });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const total = data?.reduce((acc, d) => acc + d.ganhos, 0) || 0;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Evolução Financeira</p>
        <h3 className="text-lg font-bold tracking-tight text-foreground">Ganhos por semana</h3>
        <p className="mt-1 text-xs text-muted-foreground">Últimas 8 semanas {total === 0 ? "— sem ganhos no período" : ""}</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data || []} margin={{ top: 8, right: 0, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="semana" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
            <RechartsTooltip 
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
              formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Ganhos"]}
            />
            <Bar dataKey="ganhos" fill="hsl(var(--emerald, 142 71% 45%))" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

interface ProfissionalDashboardProps {
  user: any;
  counts: {
    oportunidades: number;
    elaboracao: number;
    enviados: number;
    ativos: number;
    finalizados: number;
  };
  metrics: {
    ganhosMes: number;
    taxaAceitacao: string;
    slaMedioH: string;
    totalConcluidos: number;
    aReceber: number;
    mediaAvaliacoes: string;
  };
  orcamentos: Orcamento[];
  loading?: boolean;
  setTab: (tab: ProfissionalTab) => void;
  setPedidosSubTab: (sub: string) => void;
  setServicosSubTab: (sub: string) => void;
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-8 w-full mt-2" />
    </div>
  );
}

export function ProfissionalDashboard({
  user,
  counts,
  metrics,
  orcamentos,
  loading = false,
  setTab,
  setPedidosSubTab,
  setServicosSubTab,
}: ProfissionalDashboardProps) {
  return (
    <div className="space-y-6">
      <NotificationPermissionBanner />

      <ProfissionalHeader
        userName={(user?.user_metadata as { nome?: string })?.nome || "profissional"}
        counts={counts}
        metrics={metrics}
        onVerPedidos={() => setTab("orcamentos")}
      />

      <ProximoServicoCard userId={user?.id} orcamentos={orcamentos} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <ActionStat
              icon={Clock}
              label="Oportunidades no radar"
              value={counts.oportunidades}
              accent="from-amber-50 to-amber-100 text-amber-700 ring-amber-200"
              cta="Ver radar"
              onClick={() => {
                setPedidosSubTab("oportunidades");
                setTab("orcamentos");
              }}
            />
            <ActionStat
              icon={Pencil}
              label="Para elaborar"
              value={counts.elaboracao}
              accent="from-sky-50 to-sky-100 text-sky-700 ring-sky-200"
              cta="Elaborar agora"
              onClick={() => {
                setPedidosSubTab("elaboracao");
                setTab("orcamentos");
              }}
            />
            <ActionStat
              icon={TrendingUp}
              label="Em andamento"
              value={counts.ativos}
              accent="from-emerald-50 to-emerald-100 text-emerald-700 ring-emerald-200"
              cta="Ver serviços"
              onClick={() => {
                setServicosSubTab("ativos");
                setTab("servicos");
              }}
            />
            <ActionStat
              icon={DollarSign}
              label="A receber"
              value={`R$ ${metrics.aReceber.toFixed(2)}`}
              accent="from-orange-50 to-orange-100 text-brand ring-orange-200"
              cta="Financeiro"
              onClick={() => setTab("financeiro")}
            />
          </>
        )}
      </section>


      <PrimeirosPassosCard userId={user?.id} setTab={setTab} metrics={metrics} counts={counts} />
      
      <ProfileCompletenessCard />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : (
            <ProfissionalChart orcamentos={orcamentos as Tables<"orcamentos">[]} userId={user?.id} />
          )}
        </div>
        <div className="space-y-4">
          <NivelBadge
            concluidos={metrics.totalConcluidos}
            notaMedia={Number(metrics.mediaAvaliacoes) || 0}
          />
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-foreground">Atalhos rápidos</h3>
            </div>
            <div className="grid gap-2">
              <QuickLink
                icon={CalendarClock}
                label="Minha agenda"
                onClick={() => setTab("agenda")}
              />
              <QuickLink icon={Star} label="Avaliações" onClick={() => setTab("avaliacoes")} />
              <QuickLink icon={Wallet} label="Financeiro" onClick={() => setTab("financeiro")} />
              <QuickLink
                icon={Settings}
                label="Perfil e configurações"
                onClick={() => setTab("configuracoes")}
              />
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
