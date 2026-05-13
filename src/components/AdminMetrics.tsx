import { useEffect, useState } from "react";
import {
  DollarSign,
  ShoppingBag,
  Users,
  Star,
  Clock,
  ArrowUpRight,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  subDays,
  startOfDay,
  format,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  isSameDay,
} from "date-fns";

type Metric = {
  label: string;
  value: string;
  icon: any;
  color: string;
  bg: string;
  targetTab: any;
  change?: number; // % change
};

export function AdminMetrics({ onTabChange }: { onTabChange: (tab: any) => void }) {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "month">("30d");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [recentes, setRecentes] = useState<any[]>([]);
  const [pendentes, setPendentes] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      let startDate: Date;
      let prevStartDate: Date;

      if (timeRange === "7d") {
        startDate = subDays(now, 7);
        prevStartDate = subDays(startDate, 7);
      } else if (timeRange === "90d") {
        startDate = subDays(now, 90);
        prevStartDate = subDays(startDate, 90);
      } else if (timeRange === "month") {
        startDate = startOfMonth(now);
        prevStartDate = startOfMonth(subDays(startDate, 1));
      } else {
        startDate = subDays(now, 30);
        prevStartDate = subDays(startDate, 30);
      }

      const [{ data: orcs }, { data: avs }, { data: roles }] = await Promise.all([
        supabase
          .from("orcamentos")
          .select("*")
          .eq("is_test", false)
          .order("created_at", { ascending: false }),
        supabase.from("avaliacoes").select("nota, created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const allRoles = roles || [];
      const nonClientUserIds = new Set(
        allRoles.filter((r) => r.role !== "cliente").map((r) => r.user_id),
      );
      const clientUserIds = allRoles.filter((r) => r.role === "cliente").map((r) => r.user_id);

      // Consistent with AdminClientes: show as client if they have 'cliente' role AND NOT any other role
      const clientesCount = clientUserIds.filter((id) => !nonClientUserIds.has(id)).length;

      const list = orcs || [];
      const currentPeriod = list.filter((o) => new Date(o.created_at) >= startDate);
      const prevPeriod = list.filter((o) => {
        const d = new Date(o.created_at);
        return d >= prevStartDate && d < startDate;
      });

      // Calculate Revenue & Volume
      const calcRev = (arr: any[]) =>
        arr.filter((o) => o.status === "pago").reduce((s, o) => s + Number(o.valor || 0), 0);
      const revCurrent = calcRev(currentPeriod);
      const revPrev = calcRev(prevPeriod);
      const revChange = revPrev > 0 ? ((revCurrent - revPrev) / revPrev) * 100 : 0;

      const activeCurrent = currentPeriod.filter((o) =>
        ["enviado", "aprovado", "customizado_pendente", "agendado"].includes(o.status),
      ).length;
      const activePrev = prevPeriod.filter((o) =>
        ["enviado", "aprovado", "customizado_pendente", "agendado"].includes(o.status),
      ).length;
      const activeChange = activePrev > 0 ? ((activeCurrent - activePrev) / activePrev) * 100 : 0;

      const mediaNota =
        avs && avs.length > 0 ? (avs.reduce((s, a) => s + a.nota, 0) / avs.length).toFixed(1) : "—";

      setMetrics([
        {
          label: "Receita (pagos)",
          value: `R$ ${revCurrent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          icon: DollarSign,
          color: "text-blue-600",
          bg: "bg-blue-50",
          targetTab: "financeiro",
          change: revChange,
        },
        {
          label: "Pedidos Ativos",
          value: String(activeCurrent),
          icon: ShoppingBag,
          color: "text-brand",
          bg: "bg-brand-soft",
          targetTab: "pedidos",
          change: activeChange,
        },
        {
          label: "Clientes Total",
          value: String(clientesCount ?? 0),
          icon: Users,
          color: "text-purple-600",
          bg: "bg-purple-50",
          targetTab: "clientes",
        },
        {
          label: "Média Avaliações",
          value: `${mediaNota}`,
          icon: Star,
          color: "text-amber-600",
          bg: "bg-amber-50",
          targetTab: "profissionais",
        },
      ]);

      // Chart Data: Group by Day
      const days: any[] = [];
      for (let i = 0; i < (timeRange === "7d" ? 7 : 30); i++) {
        const d = subDays(now, i);
        const dayOrcs = currentPeriod.filter((o) => isSameDay(new Date(o.created_at), d));
        days.unshift({
          name: format(d, "dd/MM"),
          receita: dayOrcs
            .filter((o) => o.status === "pago")
            .reduce((s, o) => s + Number(o.valor || 0), 0),
          pedidos: dayOrcs.length,
        });
      }
      setChartData(days);

      // Pie Data: Service Category
      const cats: Record<string, number> = {};
      currentPeriod.forEach((o) => {
        const name = o.service_name || "Outros";
        cats[name] = (cats[name] || 0) + 1;
      });
      const pie = Object.entries(cats)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      setPieData(pie);

      setRecentes(list.slice(0, 5));
      setPendentes(list.filter((o) => o.status === "customizado_pendente").length);
      setLoading(false);
    })();
  }, [timeRange]);

  const statusCor = (s: string) => {
    switch (s) {
      case "pago":
        return "bg-emerald-50 text-emerald-700";
      case "aprovado":
        return "bg-blue-50 text-blue-700";
      case "agendado":
        return "bg-indigo-50 text-indigo-700";
      case "concluido":
        return "bg-green-50 text-green-700";
      case "enviado":
        return "bg-sky-50 text-sky-700";
      case "customizado_pendente":
        return "bg-amber-50 text-amber-700";
      case "cancelado":
      case "recusado":
        return "bg-red-50 text-red-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Dashboard Executivo
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Bem-vindo(a) ao seu centro de inteligência de negócios.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          {[
            { id: "7d", label: "7 dias" },
            { id: "30d", label: "30 dias" },
            { id: "90d", label: "90 dias" },
            { id: "month", label: "Este Mês" },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setTimeRange(r.id as any)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                timeRange === r.id
                  ? "bg-brand text-white shadow-md shadow-brand/20"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((stat) => (
          <button
            key={stat.label}
            onClick={() => onTabChange(stat.targetTab)}
            className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-brand/40 transition-all text-left relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-4">
              <div
                className={`h-11 w-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${stat.bg} ${stat.color}`}
              >
                <stat.icon className="h-6 w-6" />
              </div>
              {stat.change !== undefined && (
                <span
                  className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-bold ${stat.change >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}
                >
                  {stat.change >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(stat.change).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-400">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>

            <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-brand opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
              Ver detalhes <ArrowUpRight className="h-3 w-3" />
            </div>

            <div
              className={`absolute -right-6 -bottom-6 h-28 w-28 rounded-full opacity-0 group-hover:opacity-10 transition-opacity blur-3xl ${stat.bg}`}
            />
          </button>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-bold text-slate-900">Desempenho Financeiro</h3>
              <p className="text-xs text-slate-500">Receita bruta diária no período selecionado.</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand" /> Receita
              </div>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94A3B8" }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    fontSize: "12px",
                  }}
                  formatter={(val: number) => [`R$ ${val.toFixed(2)}`, "Receita"]}
                />
                <Area
                  type="monotone"
                  dataKey="receita"
                  stroke="var(--brand)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories Pie Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-1">Mix de Serviços</h3>
          <p className="text-xs text-slate-500 mb-8">Serviços mais solicitados.</p>

          <div className="h-[220px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"][index % 5]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900">
                {pieData.reduce((s, i) => s + i.value, 0)}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {pieData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"][
                        index % 5
                      ],
                    }}
                  />
                  <span className="text-xs font-medium text-slate-600 truncate max-w-[120px]">
                    {item.name}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {pendentes > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-amber-900">
              {pendentes} {pendentes === 1 ? "orçamento aguardando" : "orçamentos aguardando"}{" "}
              atribuição a profissional
            </p>
            <p className="text-xs text-amber-700">SLA padrão: 4h para resposta inicial.</p>
          </div>
        </div>
      )}

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Últimos Pedidos</h3>
          <Link
            to="/orcamentos"
            search={{ new: 0 } as any}
            className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
          >
            Ver todos <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              <tr>
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Serviço</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Valor</th>
                <th className="px-6 py-3">Criado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentes.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                    Nenhum pedido ainda.
                  </td>
                </tr>
              )}
              {recentes.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-xs font-mono text-slate-500">
                    #{o.id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{o.service_name}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusCor(o.status)}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">
                    R$ {Number(o.valor || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />{" "}
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
