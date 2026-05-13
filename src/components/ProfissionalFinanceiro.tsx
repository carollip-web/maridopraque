import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Download,
  Loader2,
  TrendingUp,
  Clock,
  CreditCard,
  Calendar,
  Filter,
} from "lucide-react";

type Linha = {
  id: string;
  service_name: string;
  cliente_nome: string;
  status: string;
  valor: number;
  valor_servico: number;
  taxa_material: number;
  data_pagamento: string | null;
  data_aprovacao: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  enviado: { label: "Aguardando cliente", color: "bg-sky-100 text-sky-700" },
  aprovado: { label: "Aprovado — a receber", color: "bg-amber-100 text-amber-700" },
  pago: { label: "Pago", color: "bg-emerald-100 text-emerald-700" },
  concluido: { label: "Concluído", color: "bg-emerald-100 text-emerald-700" },
  recusado: { label: "Recusado", color: "bg-rose-100 text-rose-700" },
  cancelado: { label: "Cancelado", color: "bg-slate-100 text-slate-600" },
};

type Periodo = "30d" | "90d" | "ano" | "tudo";
type Filtro = "todos" | "pagos" | "areceber";

export function ProfissionalFinanceiro() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("90d");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const { data: orcs } = await supabase
        .from("orcamentos")
        .select(
          "id, service_name, status, valor, valor_servico, taxa_material, data_pagamento, data_aprovacao, created_at, updated_at, cliente_id",
        )
        .eq("profissional_id", user.id)
        .order("updated_at", { ascending: false });
      if (!alive) return;
      const ids = Array.from(new Set((orcs ?? []).map((o: any) => o.cliente_id)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, nome").in("id", ids)
        : { data: [] as any[] };
      const nomeMap: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => {
        nomeMap[p.id] = p.nome ?? "Cliente";
      });
      const list: Linha[] = (orcs ?? []).map((o: any) => ({
        id: o.id,
        service_name: o.service_name,
        cliente_nome: nomeMap[o.cliente_id] ?? "Cliente",
        status: o.status,
        valor: Number(o.valor ?? 0),
        valor_servico: Number(o.valor_servico ?? 0),
        taxa_material: Number(o.taxa_material ?? 0),
        data_pagamento: o.data_pagamento,
        data_aprovacao: o.data_aprovacao,
        created_at: o.created_at,
        updated_at: o.updated_at,
      }));
      setLinhas(list);
      setLoading(false);
    };
    load();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const filtradas = useMemo(() => {
    const agora = new Date();
    const corte = new Date();
    if (periodo === "30d") corte.setDate(agora.getDate() - 30);
    else if (periodo === "90d") corte.setDate(agora.getDate() - 90);
    else if (periodo === "ano") corte.setFullYear(agora.getFullYear() - 1);
    else corte.setFullYear(2000);

    return linhas.filter((l) => {
      const data = new Date(l.data_pagamento ?? l.data_aprovacao ?? l.updated_at);
      if (data < corte) return false;
      if (filtro === "pagos") return l.status === "pago" || l.status === "concluido";
      if (filtro === "areceber") return l.status === "aprovado";
      return true;
    });
  }, [linhas, periodo, filtro]);

  const totais = useMemo(() => {
    const pagos = filtradas.filter((l) => l.status === "pago" || l.status === "concluido");
    const aReceber = filtradas.filter((l) => l.status === "aprovado");
    const totalPagos = pagos.reduce((a, l) => a + l.valor, 0);
    const totalReceber = aReceber.reduce((a, l) => a + l.valor, 0);
    const ticket = pagos.length ? totalPagos / pagos.length : 0;
    return {
      totalPagos,
      totalReceber,
      ticket,
      qtdPagos: pagos.length,
      qtdReceber: aReceber.length,
    };
  }, [filtradas]);

  const exportarCSV = () => {
    const headers = ["Data", "Serviço", "Cliente", "Status", "Mão de obra", "Materiais", "Total"];
    const rows = filtradas.map((l) => [
      new Date(l.data_pagamento ?? l.data_aprovacao ?? l.updated_at).toLocaleDateString("pt-BR"),
      `"${l.service_name.replace(/"/g, "''")}"`,
      `"${l.cliente_nome.replace(/"/g, "''")}"`,
      STATUS_LABEL[l.status]?.label ?? l.status,
      l.valor_servico.toFixed(2).replace(".", ","),
      l.taxa_material.toFixed(2).replace(".", ","),
      l.valor.toFixed(2).replace(".", ","),
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="py-24 grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Financeiro</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Acompanhe ganhos, recebimentos pendentes e exporte seu extrato.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatBox
          icon={DollarSign}
          label="Recebido no período"
          value={`R$ ${totais.totalPagos.toFixed(2)}`}
          sub={`${totais.qtdPagos} pagamentos`}
          accent="bg-emerald-50 text-emerald-700 border-emerald-200"
        />
        <StatBox
          icon={Clock}
          label="A receber"
          value={`R$ ${totais.totalReceber.toFixed(2)}`}
          sub={`${totais.qtdReceber} aprovados`}
          accent="bg-amber-50 text-amber-700 border-amber-200"
        />
        <StatBox
          icon={TrendingUp}
          label="Ticket médio"
          value={`R$ ${totais.ticket.toFixed(2)}`}
          sub="por serviço pago"
          accent="bg-sky-50 text-sky-700 border-sky-200"
        />
      </section>

      <section className="rounded-3xl bg-white border border-border p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {(["30d", "90d", "ano", "tudo"] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${periodo === p ? "bg-brand text-white border-brand" : "bg-white text-slate-700 border-slate-200 hover:border-brand"}`}
              >
                {p === "30d"
                  ? "Últimos 30 dias"
                  : p === "90d"
                    ? "Últimos 90 dias"
                    : p === "ano"
                      ? "Último ano"
                      : "Tudo"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Filtro:
            </div>
            {(["todos", "pagos", "areceber"] as Filtro[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${filtro === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"}`}
              >
                {f === "todos" ? "Todos" : f === "pagos" ? "Pagos" : "A receber"}
              </button>
            ))}
            <Button
              onClick={exportarCSV}
              variant="outline"
              size="sm"
              className="rounded-full text-xs h-8"
              disabled={filtradas.length === 0}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Nenhuma movimentação no período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-bold">Data</th>
                  <th className="px-4 py-2 font-bold">Serviço</th>
                  <th className="px-4 py-2 font-bold hidden md:table-cell">Cliente</th>
                  <th className="px-4 py-2 font-bold">Status</th>
                  <th className="px-4 py-2 font-bold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l) => {
                  const meta = STATUS_LABEL[l.status] ?? {
                    label: l.status,
                    color: "bg-slate-100 text-slate-700",
                  };
                  const data = new Date(l.data_pagamento ?? l.data_aprovacao ?? l.updated_at);
                  const isPago = l.status === "pago" || l.status === "concluido";
                  const isReceber = l.status === "aprovado";
                  // estimativa: 2 dias úteis após aprovação
                  const previsao =
                    isReceber && l.data_aprovacao
                      ? new Date(new Date(l.data_aprovacao).getTime() + 2 * 86400000)
                      : null;
                  return (
                    <tr
                      key={l.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition"
                    >
                      <td className="px-4 py-3 text-xs text-slate-700 tabular-nums">
                        {data.toLocaleDateString("pt-BR")}
                        {previsao && (
                          <div className="text-[10px] text-amber-700 flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3" /> previsão{" "}
                            {previsao.toLocaleDateString("pt-BR")}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{l.service_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                        {l.cliente_nome}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${meta.color}`}
                        >
                          {isPago && <CreditCard className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold">
                        R$ {l.valor.toFixed(2)}
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
