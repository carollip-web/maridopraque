import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Calendar,
  Clock,



  CheckCircle2,
  Loader2,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Search,
  RefreshCw,
  User,
  Copy,
  Check,
  Inbox,
  Receipt,
  PiggyBank,
  HeartHandshake,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AdminApoioFemininoRepasses } from "@/features/admin/AdminApoioFemininoRepasses";

// Taxa estimada do Mercado Pago para crédito à vista
const TAXA_MP_CREDITO = 0.0549;




type PagamentoRow = {
  id: string;
  status: string;
  valor_total: number | null;
  created_at: string;
  gateway: string | null;
  metadata: any;
  profissional_id: string | null;
  cliente_id: string | null;
  orcamentos?: { service_name: string | null; data_pagamento?: string | null } | null;
};

type ProfMap = Record<string, { nome: string; email: string | null }>;

const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_BADGES: Record<string, { bg: string; label: string }> = {
  pending: { bg: "bg-amber-50 border-amber-200 text-amber-700", label: "Pendente" },
  paid: { bg: "bg-emerald-50 border-emerald-200 text-emerald-700", label: "Pago" },
  approved: { bg: "bg-emerald-50 border-emerald-200 text-emerald-700", label: "Aprovado" },
  failed: { bg: "bg-red-50 border-red-200 text-red-700", label: "Falhou" },
  cancelled: { bg: "bg-slate-100 border-slate-200 text-slate-600", label: "Cancelado" },
  canceled: { bg: "bg-slate-100 border-slate-200 text-slate-600", label: "Cancelado" },
  rejected: { bg: "bg-red-50 border-red-200 text-red-700", label: "Rejeitado" },
};

const PERIODOS = [
  { id: "7", label: "7 dias" },
  { id: "30", label: "30 dias" },
  { id: "90", label: "90 dias" },
  { id: "all", label: "Tudo" },
];

// Extrai a taxa de marketplace do pagamento (com fallback 15%)
function getMarketplaceFee(r: PagamentoRow): number {
  const meta = r?.metadata || {};
  const direct =
    meta?.marketplace_fee_amount ??
    meta?.application_fee ??
    meta?.application_fee_amount;
  if (direct != null && !isNaN(Number(direct))) return Number(direct);
  const details = meta?.last_webhook_payload?.fee_details;
  if (Array.isArray(details)) {
    const app = details.find((d: any) => d?.type === "application_fee");
    if (app?.amount != null) return Number(app.amount);
  }
  return Number(r?.valor_total || 0) * 0.15;
}

export function AdminFinanceiro() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagamentos, setPagamentos] = useState<PagamentoRow[]>([]);
  const [estornosPendentes, setEstornosPendentes] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<ProfMap>({});
  const [ledger, setLedger] = useState<{
    totalRecebido: number;
    totalTaxaPlat: number;
  }>({ totalRecebido: 0, totalTaxaPlat: 0 });

  // UI state
  const [tab, setTab] = useState<"mp" | "apoio">("mp");

  const [periodo, setPeriodo] = useState<string>("30");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");


  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadAll = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);

    const [{ data: pgs }, { data: splits, error: splitsError }] = await Promise.all([
      supabase
        .from("pagamentos")
        .select(
          `id, status, valor_total, created_at, gateway, metadata, profissional_id, cliente_id,
           orcamentos!fk_pag_orcamento ( service_name, data_pagamento )`,
        )
        .eq("gateway", "mercado_pago")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("pagamento_splits")
        .select("id, orcamento_id, valor_total, taxa_plataforma, taxa_gateway, valor_profissional, status, metadata, orcamentos(service_name)"),
    ]);

    if (splitsError) {
      console.error("Erro ao ler pagamento_splits (possível bloqueio de RLS):", splitsError);
      toast.error("Aviso: RLS impediu a leitura de pagamento_splits.");
    }

    const list = (pgs || []) as PagamentoRow[];
    setPagamentos(list);

    // Profiles em batch
    const userIds = Array.from(
      new Set(
        [
          ...list.map((r) => r.profissional_id).filter(Boolean) as string[],
          ...list.map((r) => r.cliente_id).filter(Boolean) as string[],
        ],
      ),
    );
    if (userIds.length) {
      const { data: profsData } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);
      const map: ProfMap = {};
      (profsData || []).forEach((p: any) => {
        map[p.id] = { nome: p.nome, email: p.email };
      });
      setProfiles(map);
    }

    // Ledger (pagamento_splits) — splits MP são liquidados automaticamente
    const sp = splits || [];
    const totalRecebido = sp.reduce((s, x: any) => s + Number(x.valor_total || 0), 0);
    const totalTaxaPlat = sp.reduce(
      (s, x: any) => s + Number(x.taxa_plataforma || 0) + Number(x.taxa_gateway || 0),
      0,
    );
    setLedger({ totalRecebido, totalTaxaPlat });

    const pendingRefunds = sp.filter((s: any) => 
      String(s.metadata?.estorno_pendente_saldo) === "true" && 
      !s.metadata?.refund_id
    );
    setEstornosPendentes(pendingRefunds);

    setLoading(false);
    setRefreshing(false);
  }, []);


  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Aplica filtro de período aos pagamentos
  const pagamentosPeriodo = useMemo(() => {
    if (periodo === "all") return pagamentos;
    const dias = Number(periodo);
    const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
    return pagamentos.filter((p) => new Date(p.created_at).getTime() >= limite);
  }, [pagamentos, periodo]);

  // Métricas
  const metrics = useMemo(() => {
    const aprovados = pagamentosPeriodo.filter(
      (r) => r.status === "approved" || r.status === "paid",
    );
    const bruto = aprovados.reduce((acc, r) => acc + Number(r.valor_total || 0), 0);
    const comissao = aprovados.reduce((acc, r) => acc + getMarketplaceFee(r), 0);
    const taxaMP = aprovados.reduce(
      (acc, r) => acc + Number(r.valor_total || 0) * TAXA_MP_CREDITO,
      0,
    );
    const liquidoPro = bruto - comissao - taxaMP;
    const pendente = pagamentosPeriodo
      .filter((r) => r.status === "pending")
      .reduce((acc, r) => acc + Number(r.valor_total || 0), 0);
    const apoio = aprovados.reduce(
      (acc, r) => acc + Number((r.metadata as Record<string, unknown>)?.valor_apoio_feminino || 0),
      0,
    );
    return {
      bruto,
      comissao,
      taxaMP,
      liquidoPro,
      pendente,
      apoio,
      qtdAprovados: aprovados.length,
      qtdPendentes: pagamentosPeriodo.filter((r) => r.status === "pending").length,
    };
  }, [pagamentosPeriodo]);




  // Tabela filtrada
  const pagamentosFiltrados = useMemo(() => {
    return pagamentosPeriodo.filter((r) => {
      const matchStatus =
        statusFilter === "todos" ||
        r.status === statusFilter ||
        (statusFilter === "paid" && r.status === "approved");
      const q = search.toLowerCase().trim();
      if (!q) return matchStatus;
      const profName = r.profissional_id
        ? (profiles[r.profissional_id]?.nome || "").toLowerCase()
        : "";
      const cliName = r.cliente_id ? (profiles[r.cliente_id]?.nome || "").toLowerCase() : "";
      const srv = (r.orcamentos?.service_name || "").toLowerCase();
      return (
        matchStatus &&
        (profName.includes(q) ||
          cliName.includes(q) ||
          srv.includes(q) ||
          r.id.toLowerCase().includes(q))
      );
    });
  }, [pagamentosPeriodo, statusFilter, search, profiles]);




  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success("Copiado!");
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (loading) {
    return (
      <div className="py-24 grid place-items-center">
        <Loader2 className="h-10 w-10 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER + FILTRO DE PERÍODO */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Painel Financeiro
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Visão unificada de pagamentos e splits Mercado Pago. Repasses ao profissional são automáticos.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  periodo === p.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAll(false)}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={DollarSign}
          label="Volume Bruto"
          value={brl(metrics.bruto)}
          sub={`${metrics.qtdAprovados} pagamentos`}
          tone="slate"
        />
        <KpiCard
          icon={TrendingUp}
          label="Comissão Plataforma"
          value={brl(metrics.comissao)}
          sub="15% retidos no MP"
          tone="emerald"
        />
        <KpiCard
          icon={Receipt}
          label="Taxa Gateway (est.)"
          value={brl(metrics.taxaMP)}
          sub="5,49% Mercado Pago"
          tone="rose"
        />
        <KpiCard
          icon={PiggyBank}
          label="Líquido Profissionais"
          value={brl(metrics.liquidoPro)}
          sub="repasse efetivo"
          tone="indigo"
        />
        <KpiCard
          icon={Clock}
          label="Pendentes (MP)"
          value={brl(metrics.pendente)}
          sub={`${metrics.qtdPendentes} aguardando`}
          tone="amber"
        />
      </div>

      {/* Ledger consolidado */}
      <div className="grid gap-4 md:grid-cols-3">
        <MiniCard
          label="Ledger · Total recebido"
          value={brl(ledger.totalRecebido)}
          hint="Soma dos splits registrados"
        />
        <MiniCard
          label="Ledger · Taxas totais"
          value={brl(ledger.totalTaxaPlat)}
          hint="Plataforma + gateway"
          accent="text-emerald-600"
        />
        {metrics.apoio > 0 && (
          <MiniCard
            label="Repasses Apoio Feminino"
            value={brl(metrics.apoio)}
            hint="Retidos via Mercado Pago"
            accent="text-pink-600"
          />
        )}
      </div>

      {/* Estornos Pendentes */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-bold text-slate-900">Estornos pendentes</h3>
        </div>
        {estornosPendentes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum estorno pendente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold border-b border-slate-100 bg-slate-50/50">
                  <th className="px-5 py-3">ID Pedido</th>
                  <th className="px-5 py-3">Serviço</th>
                  <th className="px-5 py-3 text-right">Valor do Estorno</th>
                  <th className="px-5 py-3 text-center">Pendente Desde</th>
                  <th className="px-5 py-3 text-center">Última Tentativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {estornosPendentes.map((est) => {
                  const srvName = Array.isArray(est.orcamentos) 
                    ? est.orcamentos[0]?.service_name 
                    : est.orcamentos?.service_name;
                  return (
                    <tr key={est.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-600">
                        #{String(est.orcamento_id).slice(0, 8)}
                      </td>
                      <td className="px-5 py-3 font-bold text-sm text-slate-900">
                        {srvName || "Serviço"}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-sm text-amber-600 tabular-nums">
                        {brl(Number(est.metadata?.valor_reembolso || 0))}
                      </td>
                      <td className="px-5 py-3 text-center text-xs text-slate-500">
                        {est.metadata?.estorno_pendente_desde
                          ? new Date(est.metadata.estorno_pendente_desde).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-center text-xs text-slate-500">
                        {est.metadata?.ultima_tentativa_estorno
                          ? new Date(est.metadata.ultima_tentativa_estorno).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* TABS */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          <TabBtn active={tab === "mp"} onClick={() => setTab("mp")} icon={CreditCard}>
            Transações MP
          </TabBtn>
          <TabBtn
            active={tab === "apoio"}
            onClick={() => setTab("apoio")}
            icon={HeartHandshake}
          >
            Apoio Feminino
          </TabBtn>
        </div>
      </div>


      {/* CONTEÚDO DAS TABS */}
      {tab === "mp" && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          {/* Filtros */}
          <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { id: "todos", label: "Todos" },
                { id: "pending", label: "Pendentes" },
                { id: "paid", label: "Pagos" },
                { id: "failed", label: "Falharam" },
                { id: "cancelled", label: "Cancelados" },
              ].map((it) => (
                <button
                  key={it.id}
                  onClick={() => setStatusFilter(it.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    statusFilter === it.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {it.label}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Buscar profissional, serviço, ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>
          </div>

          {pagamentosFiltrados.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center gap-2">
              <Inbox className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500 font-medium">
                Nenhum pagamento encontrado
              </p>
              <p className="text-xs text-slate-400">Tente ajustar período ou filtros.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[960px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold border-b border-slate-100 bg-slate-50/50">
                    <th className="px-5 py-3">ID / Data</th>
                    <th className="px-5 py-3">Serviço / Profissional</th>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3 text-right">Bruto</th>
                    <th className="px-5 py-3 text-right">Fee 15%</th>
                    <th className="px-5 py-3 text-right">Taxa MP</th>
                    <th className="px-5 py-3 text-right">Líquido Pro</th>
                    <th className="px-5 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagamentosFiltrados.slice(0, 100).map((p) => {
                    const prof = p.profissional_id ? profiles[p.profissional_id] : null;
                    const cli = p.cliente_id ? profiles[p.cliente_id] : null;
                    const valor = Number(p.valor_total || 0);
                    const fee = getMarketplaceFee(p);
                    const taxaMP = Math.round(valor * TAXA_MP_CREDITO * 100) / 100;
                    const liquido = Math.round((valor - fee - taxaMP) * 100) / 100;
                    const badge =
                      STATUS_BADGES[p.status] || {
                        bg: "bg-slate-100 text-slate-700 border-slate-200",
                        label: p.status,
                      };
                    const efetivado = p.status === "paid" || p.status === "approved";
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition group">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-slate-600">
                              #{p.id.slice(0, 8)}
                            </span>
                            <button
                              onClick={() => handleCopy(p.id)}
                              className="text-slate-400 hover:text-slate-900"
                              title="Copiar ID"
                            >
                              {copiedId === p.id ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                              )}
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(p.created_at).toLocaleString("pt-BR")}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-bold text-sm text-slate-900">
                            {p.orcamentos?.service_name || "Serviço"}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" /> {prof?.nome || "—"}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600">
                          {cli?.nome || "—"}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-sm text-slate-900 tabular-nums">
                          {brl(valor)}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-brand font-bold tabular-nums">
                          {efetivado ? brl(fee) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-rose-500 font-bold tabular-nums">
                          {efetivado ? (
                            <>
                              − {brl(taxaMP)}
                              <div className="text-[9px] text-slate-300 font-medium">est.</div>
                            </>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-emerald-600 font-bold tabular-nums">
                          {efetivado ? brl(liquido) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pagamentosFiltrados.length > 100 && (
                <p className="px-5 py-3 text-xs text-slate-400 text-center border-t border-slate-100">
                  Mostrando 100 de {pagamentosFiltrados.length}. Refine os filtros para ver mais.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "apoio" && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <AdminApoioFemininoRepasses />
        </section>
      )}



    </div>
  );
}

// ============== Subcomponentes ==============

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  tone: "slate" | "emerald" | "amber" | "brand" | "rose" | "indigo";
}) {
  const tones: Record<string, string> = {
    slate: "from-slate-50 to-white text-slate-700 ring-slate-200",
    emerald: "from-emerald-50 to-white text-emerald-700 ring-emerald-200",
    amber: "from-amber-50 to-white text-amber-700 ring-amber-200",
    brand: "from-orange-50 to-white text-brand ring-orange-200",
    rose: "from-rose-50 to-white text-rose-600 ring-rose-200",
    indigo: "from-indigo-50 to-white text-indigo-700 ring-indigo-200",
  };
  const valColor: Record<string, string> = {
    slate: "text-slate-900",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    brand: "text-brand",
    rose: "text-rose-600",
    indigo: "text-indigo-700",
  };
  return (
    <div
      className={`bg-gradient-to-br ${tones[tone]} ring-1 rounded-2xl p-5 shadow-sm hover:shadow-md transition`}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-extrabold opacity-80">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className={`text-2xl font-black mt-2 tabular-nums ${valColor[tone]}`}>{value}</p>
      {sub && <p className="text-[11px] opacity-70 mt-1 font-medium">{sub}</p>}
    </div>
  );
}

function MiniCard({
  label,
  value,
  hint,
  accent = "text-slate-900",
}: {
  label: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <h3 className={`text-xl font-bold mt-1 tabular-nums ${accent}`}>{value}</h3>
      <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
        active
          ? "border-brand text-brand"
          : "border-transparent text-slate-500 hover:text-slate-900"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
