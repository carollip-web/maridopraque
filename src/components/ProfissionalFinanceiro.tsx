import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DollarSign,
  Loader2,
  TrendingUp,
  Clock,
  Wallet,
  CheckCircle2,
  RefreshCw,
  Search,
  Info,
  CreditCard,
  Banknote,
  QrCode,
} from "lucide-react";

type Split = {
  id: string;
  valor_total: number;
  valor_profissional: number;
  taxa_plataforma: number;
  taxa_gateway: number;
  status: string;
  disponivel_em: string | null;
  pago_em: string | null;
  created_at: string;
  orcamento_id: string;
  pagamento_id: string | null;
  orcamentos?: { service_name: string | null; status: string | null } | null;
  pagamentos?: {
    payment_method_id: string | null;
    installments: number | null;
    metodo: string | null;
    paid_at: string | null;
  } | null;
};

const SPLIT_STATUS: Record<string, { label: string; color: string }> = {
  aguardando_conclusao: { label: "A liberar", color: "bg-amber-100 text-amber-700" },
  disponivel: { label: "Disponível", color: "bg-emerald-100 text-emerald-700" },
  pago: { label: "Recebido", color: "bg-emerald-100 text-emerald-700" },
  retido: { label: "Retido", color: "bg-rose-100 text-rose-700" },
  estornado: { label: "Estornado", color: "bg-slate-100 text-slate-600" },
  cancelado: { label: "Cancelado", color: "bg-slate-100 text-slate-600" },
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const methodMeta = (
  method: string | null,
  fallback: string | null,
): { label: string; Icon: any; color: string } => {
  const m = (method || fallback || "").toLowerCase();
  if (m.includes("pix")) return { label: "PIX", Icon: QrCode, color: "text-emerald-600" };
  if (m.includes("bolbradesco") || m.includes("ticket") || m.includes("boleto"))
    return { label: "Boleto", Icon: Banknote, color: "text-slate-600" };
  if (m.includes("debit") || m.includes("debit_card"))
    return { label: "Débito", Icon: CreditCard, color: "text-sky-600" };
  if (m) return { label: m.toUpperCase(), Icon: CreditCard, color: "text-indigo-600" };
  return { label: "—", Icon: CreditCard, color: "text-slate-400" };
};

const PERIODOS = [
  { v: "7", label: "Últimos 7 dias" },
  { v: "30", label: "Últimos 30 dias" },
  { v: "90", label: "Últimos 90 dias" },
  { v: "all", label: "Todo período" },
];

export function ProfissionalFinanceiro() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [splits, setSplits] = useState<Split[]>([]);
  const [periodo, setPeriodo] = useState("30");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [busca, setBusca] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: sp } = await supabase
      .from("pagamento_splits")
      .select(
        "id,valor_total,valor_profissional,taxa_plataforma,taxa_gateway,status,disponivel_em,pago_em,created_at,orcamento_id,pagamento_id,orcamentos(service_name,status),pagamentos(payment_method_id,installments,metodo,paid_at,status)",
      )
      .eq("profissional_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setSplits((sp as any as Split[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const splitsPeriodo = useMemo(() => {
    if (periodo === "all") return splits;
    const dias = Number(periodo);
    const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
    return splits.filter((s) => new Date(s.created_at).getTime() >= limite);
  }, [splits, periodo]);

  const metricas = useMemo(() => {
    // Com split automático do MP, o dinheiro cai na conta MP do profissional
    // assim que o pagamento é aprovado — independente do status do escrow interno.
    const isPagoMP = (s: Split) => {
      const ps = (s.pagamentos?.paid_at ?? null) !== null;
      const status = (s as any).pagamentos?.status as string | undefined;
      return (
        ps ||
        status === "paid" ||
        status === "pago" ||
        status === "approved" ||
        s.status === "pago" ||
        s.status === "disponivel"
      );
    };

    const recebidos = splitsPeriodo.filter(
      (s) => isPagoMP(s) && s.status !== "estornado" && s.status !== "cancelado",
    );
    const aLiberar = splitsPeriodo.filter(
      (s) => !isPagoMP(s) && s.status === "aguardando_conclusao",
    );

    const liquidoRecebido = recebidos.reduce(
      (acc, s) => acc + Number(s.valor_profissional || 0),
      0,
    );
    const brutoRecebido = recebidos.reduce(
      (acc, s) => acc + Number(s.valor_total || 0),
      0,
    );
    const totalALiberar = aLiberar.reduce(
      (acc, s) => acc + Number(s.valor_profissional || 0),
      0,
    );
    const taxasTotal = recebidos.reduce(
      (acc, s) =>
        acc + Number(s.taxa_plataforma || 0) + Number(s.taxa_gateway || 0),
      0,
    );
    const ticket = recebidos.length ? liquidoRecebido / recebidos.length : 0;

    // Mês atual
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const noMes = splits
      .filter((s) => isPagoMP(s) && new Date(s.created_at) >= inicioMes)
      .reduce((acc, s) => acc + Number(s.valor_profissional || 0), 0);

    return {
      liquidoRecebido,
      brutoRecebido,
      totalALiberar,
      taxasTotal,
      ticket,
      noMes,
      qtdRecebidos: recebidos.length,
      qtdALiberar: aLiberar.length,
    };
  }, [splitsPeriodo, splits]);

  const listaFiltrada = useMemo(() => {
    let l = splitsPeriodo;
    if (statusFiltro !== "all") l = l.filter((s) => s.status === statusFiltro);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      l = l.filter(
        (s) =>
          (s.orcamentos?.service_name ?? "").toLowerCase().includes(q) ||
          s.orcamento_id.toLowerCase().includes(q),
      );
    }
    return l;
  }, [splitsPeriodo, statusFiltro, busca]);

  if (loading) {
    return (
      <div className="py-24 grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Financeiro</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Os valores são creditados automaticamente na sua conta Mercado Pago via split.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[180px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.v} value={p.v}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={load}
            className="rounded-full"
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-sky-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-sky-900">
          <strong>Split automático Mercado Pago:</strong> sua parte é creditada
          direto na sua conta MP a cada pagamento aprovado. Não é necessário pedir
          saque por aqui — gerencie seu saldo pelo app/site do Mercado Pago.
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          icon={Wallet}
          label="Recebido líquido"
          value={brl(metricas.liquidoRecebido)}
          sub={`${metricas.qtdRecebidos} pagamento(s) no período`}
          accent="bg-emerald-50 text-emerald-700 border-emerald-200"
        />
        <StatBox
          icon={TrendingUp}
          label="No mês atual"
          value={brl(metricas.noMes)}
          sub="líquido recebido este mês"
          accent="bg-brand/5 text-brand border-brand/20"
        />
        <StatBox
          icon={Clock}
          label="A liberar"
          value={brl(metricas.totalALiberar)}
          sub={`${metricas.qtdALiberar} serviço(s) em andamento`}
          accent="bg-amber-50 text-amber-700 border-amber-200"
        />
        <StatBox
          icon={CheckCircle2}
          label="Ticket médio"
          value={brl(metricas.ticket)}
          sub="por pagamento recebido"
          accent="bg-slate-50 text-slate-700 border-slate-200"
        />
      </section>

      <section className="rounded-3xl bg-white border border-border p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-brand" /> Pagamentos
          </h3>
          <div className="text-xs text-muted-foreground">
            Bruto: <span className="font-bold tabular-nums">{brl(metricas.brutoRecebido)}</span>{" "}
            · Taxas: <span className="font-bold tabular-nums text-rose-600">− {brl(metricas.taxasTotal)}</span>
          </div>
        </div>

        <Tabs value={statusFiltro} onValueChange={setStatusFiltro} className="mb-3">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="pago">Recebidos</TabsTrigger>
            <TabsTrigger value="aguardando_conclusao">A liberar</TabsTrigger>
            <TabsTrigger value="estornado">Estornados</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por serviço ou ID do orçamento..."
            className="pl-9 rounded-full"
          />
        </div>

        {listaFiltrada.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Nenhum pagamento neste filtro.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-bold">Data</th>
                  <th className="px-3 py-2 font-bold">Serviço</th>
                  <th className="px-3 py-2 font-bold">Método</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                  <th className="px-3 py-2 font-bold text-right">Bruto</th>
                  <th className="px-3 py-2 font-bold text-right">Comissão</th>
                  <th className="px-3 py-2 font-bold text-right">Taxa MP</th>
                  <th className="px-3 py-2 font-bold text-right">Você recebeu</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((sp) => {
                  const meta =
                    SPLIT_STATUS[sp.status] ?? {
                      label: sp.status,
                      color: "bg-slate-100 text-slate-700",
                    };
                  const mm = methodMeta(
                    sp.pagamentos?.payment_method_id ?? null,
                    sp.pagamentos?.metodo ?? null,
                  );
                  const inst = sp.pagamentos?.installments ?? null;
                  return (
                    <tr
                      key={sp.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-3 py-2.5 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {new Date(sp.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {sp.orcamentos?.service_name ?? "Serviço"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <mm.Icon className={`h-3.5 w-3.5 ${mm.color}`} />
                          <span className="font-medium text-slate-700">{mm.label}</span>
                          {inst && inst > 1 && (
                            <span className="text-[10px] text-slate-500">
                              {inst}x
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                        {sp.status === "aguardando_conclusao" && sp.disponivel_em && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            libera {new Date(sp.disponivel_em).toLocaleDateString("pt-BR")}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {brl(Number(sp.valor_total))}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">
                        − {brl(Number(sp.taxa_plataforma))}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">
                        − {brl(Number(sp.taxa_gateway))}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-emerald-700">
                        {brl(Number(sp.valor_profissional))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className={`rounded-3xl border p-5 ${accent}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold opacity-90">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="text-2xl font-bold mt-2 tabular-nums">{value}</p>
      <p className="text-xs opacity-75 mt-0.5">{sub}</p>
    </div>
  );
}
