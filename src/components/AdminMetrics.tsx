import { useEffect, useState, useRef } from "react";
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
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileJson,
  Loader2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { exportDashboardData } from "@/features/admin/exportDashboard";
import {
  DateRangeFilter,
  resolveDateRange,
  resolvePrevRange,
  type TimePreset,
  type DateRange,
} from "@/features/admin/DateRangeFilter";
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
  format,
  isSameDay,
  differenceInDays,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  BarChart,
  Bar,
} from "recharts";

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
  const [preset, setPreset] = useState<TimePreset>("30d");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [weeklyChartData, setWeeklyChartData] = useState<any[]>([]);
  const [recentes, setRecentes] = useState<any[]>([]);
  const [pendentes, setPendentes] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Compute resolved range
  const currentRange = resolveDateRange(preset, customRange);
  const prevRange = resolvePrevRange(currentRange);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const startDate = currentRange.from;
      const endDate = currentRange.to;
      const prevStartDate = prevRange.from;
      const prevEndDate = prevRange.to;

      const [{ data: orcs }, { data: avs }, { data: roles }, { data: repassesData }] =
        await Promise.all([
          supabase
            .from("orcamentos")
            .select("*")
            .eq("is_test", false)
            .order("created_at", { ascending: false }),
          supabase.from("avaliacoes").select("nota, created_at"),
          supabase.from("user_roles").select("user_id, role"),
          supabase
            .from("repasses_profissionais")
            .select("created_at, status, valor_comissao_marketplace"),
        ]);

      const allRoles = roles || [];
      const nonClientUserIds = new Set(
        allRoles.filter((r) => r.role !== "cliente").map((r) => r.user_id),
      );
      const clientUserIds = allRoles.filter((r) => r.role === "cliente").map((r) => r.user_id);

      // Consistent with AdminClientes: show as client if they have 'cliente' role AND NOT any other role
      const clientesCount = clientUserIds.filter((id) => !nonClientUserIds.has(id)).length;

      const list = orcs || [];
      const currentPeriod = list.filter((o) => {
        const d = new Date(o.created_at);
        return d >= startDate && d <= endDate;
      });
      const prevPeriod = list.filter((o) => {
        const d = new Date(o.created_at);
        return d >= prevStartDate && d < prevEndDate;
      });

      const repasses = repassesData || [];
      const currentRepasses = repasses.filter((r) => {
        const d = new Date(r.created_at);
        return d >= startDate && d <= endDate;
      });
      const prevRepasses = repasses.filter((r) => {
        const d = new Date(r.created_at);
        return d >= prevStartDate && d < prevEndDate;
      });

      // Calculate Revenue & Volume from repasses (lucro real)
      const calcRev = (arr: any[]) =>
        arr.reduce((s, r) => s + Number(r.valor_comissao_marketplace || 0), 0);
      const revCurrent = calcRev(currentRepasses);
      const revPrev = calcRev(prevRepasses);
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

      // Chart Data: Group by Day within the selected range
      const totalDays = Math.min(differenceInDays(endDate, startDate) + 1, 90);
      const daysList = eachDayOfInterval({
        start: totalDays > 90 ? subDays(endDate, 89) : startDate,
        end: endDate,
      });

      const days: any[] = daysList.map((d) => {
        const dayOrcs = currentPeriod.filter((o) => isSameDay(new Date(o.created_at), d));
        const dayRepasses = currentRepasses.filter((r) => isSameDay(new Date(r.created_at), d));
        return {
          name: format(d, "dd/MM"),
          receita: dayRepasses.reduce((s, r) => s + Number(r.valor_comissao_marketplace || 0), 0),
          pedidos: dayOrcs.length,
        };
      });
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

      // Funnel Data
      const passouDe = (status: string) => {
        const statusOrder = ["customizado_pendente", "enviado", "aprovado", "pago", "concluido"];
        const idx = statusOrder.indexOf(status);
        return currentPeriod.filter((o) => statusOrder.indexOf(o.status) >= idx).length;
      };
      
      const totalPedidos = currentPeriod.length;
      const cotados = passouDe("enviado");
      const aprovados = passouDe("aprovado");
      const pagos = passouDe("pago");
      const concluidos = passouDe("concluido");

      setFunnelData({
        total: totalPedidos,
        cotados,
        aprovados,
        pagos,
        concluidos,
        taxaCotados: totalPedidos ? (cotados / totalPedidos) * 100 : 0,
        taxaAprovados: cotados ? (aprovados / cotados) * 100 : 0,
        taxaPagos: aprovados ? (pagos / aprovados) * 100 : 0,
        taxaConcluidos: pagos ? (concluidos / pagos) * 100 : 0,
      });

      // Weekly Chart Data (last 8 weeks from today)
      const weeksData = [];
      const now = new Date();
      for (let i = 7; i >= 0; i--) {
        const d = subDays(now, i * 7);
        const start = startOfWeek(d, { weekStartsOn: 1 });
        const end = endOfWeek(d, { weekStartsOn: 1 });
        const count = list.filter((o) => {
          if (!["pago", "concluido"].includes(o.status)) return false;
          const od = new Date(o.created_at);
          return od >= start && od <= end;
        }).length;
        weeksData.push({
          name: format(start, "dd/MMM", { locale: ptBR }),
          Realizados: count,
        });
      }
      setWeeklyChartData(weeksData);

      setRecentes(list.slice(0, 5));
      setPendentes(list.filter((o) => o.status === "customizado_pendente").length);
      setLoading(false);
    })();
  }, [preset, customRange]);

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
      {/* Header with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Dashboard Executivo
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Bem-vindo(a) ao seu centro de inteligência de negócios.
          </p>
        </div>

        <div className="flex gap-2 items-center">
          {/* Export Dropdown */}
          <div className="relative ml-2" ref={exportRef}>
            <button
              onClick={() => setExportOpen((v) => !v)}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-brand/40 transition-all shadow-sm disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Exportar
              <ChevronDown className={`h-3 w-3 transition-transform ${exportOpen ? "rotate-180" : ""}`} />
            </button>

            {exportOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-2 border-b border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-1">Formato de exportação</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={async () => {
                      setExporting(true);
                      setExportOpen(false);
                      try {
                        await exportDashboardData("csv");
                      } finally {
                        setExporting(false);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all group"
                  >
                    <div className="h-9 w-9 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold">Planilha CSV</p>
                      <p className="text-[10px] text-slate-400">Compatível com Excel e Google Sheets</p>
                    </div>
                  </button>
                  <button
                    onClick={async () => {
                      setExporting(true);
                      setExportOpen(false);
                      try {
                        await exportDashboardData("json");
                      } finally {
                        setExporting(false);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-all group"
                  >
                    <div className="h-9 w-9 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                      <FileJson className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold">Dados JSON</p>
                      <p className="text-[10px] text-slate-400">Para análise e integrações</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shared Date Range Filter — visible on both tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800">
          Métricas Principais
        </h2>
        <DateRangeFilter
          preset={preset}
          customRange={customRange}
          onPresetChange={setPreset}
          onCustomRangeChange={setCustomRange}
        />
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

      {/* Funil de Conversão */}
      {funnelData && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-slate-400" />
            <h3 className="font-bold text-slate-900">Funil de Conversão do Período</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col items-center text-center">
              <p className="text-xs font-medium text-slate-500 mb-1">Total de Pedidos</p>
              <p className="text-3xl font-black text-slate-800">{funnelData.total}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 w-full h-1 bg-emerald-500" />
              <p className="text-xs font-medium text-slate-500 mb-1">Cotados</p>
              <p className="text-3xl font-black text-emerald-600">{funnelData.cotados}</p>
              <p className="text-[11px] text-emerald-600/70 font-bold mt-1">{funnelData.taxaCotados.toFixed(1)}% do total</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 w-full h-1 bg-blue-500" />
              <p className="text-xs font-medium text-slate-500 mb-1">Aprovados</p>
              <p className="text-3xl font-black text-blue-600">{funnelData.aprovados}</p>
              <p className="text-[11px] text-blue-600/70 font-bold mt-1">{funnelData.taxaAprovados.toFixed(1)}% dos cotados</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 w-full h-1 bg-indigo-500" />
              <p className="text-xs font-medium text-slate-500 mb-1">Pagos / Concluídos</p>
              <p className="text-3xl font-black text-indigo-600">{funnelData.pagos}</p>
              <p className="text-[11px] text-indigo-600/70 font-bold mt-1">{funnelData.taxaPagos.toFixed(1)}% dos aprovados</p>
            </div>
          </div>
        </section>
      )}

      {/* Evolução Semanal BarChart */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-1">Evolução Semanal (Últimas 8 semanas)</h3>
        <p className="text-xs text-slate-500 mb-8">Serviços realizados (pagos ou concluídos) por semana.</p>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94A3B8" }} dy={10} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "#F8FAFC" }}
                contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", fontSize: "12px" }}
              />
              <Bar dataKey="Realizados" fill="var(--brand)" radius={[6, 6, 6, 6]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
            search={{ new: 0 }}
            className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
          >
            Ver todos <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
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
