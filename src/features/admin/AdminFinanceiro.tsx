import React, { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Calendar, Clock, Landmark, Wallet, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type SaqueRow = {
  id: string;
  profissional_id: string;
  valor: number;
  status: string;
  chave_pix: string | null;
  observacao: string | null;
  solicitado_em: string;
  comprovante_url: string | null;
  profissional_nome?: string | null;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });



export function AdminFinanceiro() {
  const [data, setData] = useState<{
    totalFaturado: number;
    lucroPlataforma: number;
    saldoPendenteBtg: number;
    pagos: any[];
  } | null>(null);

  const [ledger, setLedger] = useState<{
    totalRecebido: number;
    totalTaxa: number;
    totalAPagar: number;
  } | null>(null);
  const [saques, setSaques] = useState<SaqueRow[]>([]);
  const [comprovantes, setComprovantes] = useState<Record<string, string>>({});
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    // legacy repasses para compatibilidade com tela existente
    const { data: repasses } = await supabase
      .from("repasses_profissionais")
      .select(
        `id, status, valor_bruto, valor_comissao_marketplace, valor_liquido, created_at,
         orcamentos ( service_name, data_pagamento )`,
      )
      .order("created_at", { ascending: false })
      .limit(200);
    const list = repasses || [];
    const totalFaturado = list.reduce((s: number, r: any) => s + Number(r.valor_bruto || 0), 0);
    const lucroPlataforma = list.reduce(
      (s: number, r: any) => s + Number(r.valor_comissao_marketplace || 0),
      0,
    );
    const saldoPendenteBtg = list
      .filter((r: any) => ["pendente", "aprovado", "processando"].includes(r.status))
      .reduce((s: number, r: any) => s + Number(r.valor_liquido || 0), 0);
    const pagos = list.map((r: any) => ({
      id: r.id,
      service_name: r.orcamentos?.service_name || "Serviço",
      data_pagamento: r.orcamentos?.data_pagamento || r.created_at,
      valor: r.valor_bruto,
    }));
    setData({ totalFaturado, lucroPlataforma, saldoPendenteBtg, pagos });

    // novo ledger (pagamento_splits)
    const { data: splits } = await supabase
      .from("pagamento_splits")
      .select("valor_total, taxa_plataforma, taxa_gateway, valor_profissional, status");
    const sList = splits || [];
    const totalRecebido = sList.reduce((s, x: any) => s + Number(x.valor_total || 0), 0);
    const totalTaxa = sList.reduce(
      (s, x: any) => s + Number(x.taxa_plataforma || 0) + Number(x.taxa_gateway || 0),
      0,
    );
    const totalAPagar = sList
      .filter((x: any) => ["aguardando_conclusao", "disponivel", "solicitado"].includes(x.status))
      .reduce((s, x: any) => s + Number(x.valor_profissional || 0), 0);
    setLedger({ totalRecebido, totalTaxa, totalAPagar });

    // saques
    const { data: sqRows } = await supabase
      .from("profissional_saques")
      .select("id, profissional_id, valor, status, chave_pix, observacao, solicitado_em, comprovante_url")
      .order("solicitado_em", { ascending: false })
      .limit(100);
    const rows = (sqRows || []) as SaqueRow[];
    const ids = Array.from(new Set(rows.map((r) => r.profissional_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", ids);
      const nameMap = new Map((profs || []).map((p: any) => [p.id, p.nome]));
      rows.forEach((r) => (r.profissional_nome = nameMap.get(r.profissional_id) ?? null));
    }
    setSaques(rows);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const atualizarSaque = async (
    id: string,
    patch: { status: string; comprovante_url?: string | null; aprovado_em?: string },
  ) => {
    const { error } = await supabase.from("profissional_saques").update(patch).eq("id", id);
    if (error) {
      toast.error("Erro: " + error.message);
      return false;
    }
    return true;
  };

  const aprovar = async (id: string) => {
    setProcessandoId(id);
    const ok = await atualizarSaque(id, { status: "aprovado", aprovado_em: new Date().toISOString() });
    setProcessandoId(null);
    if (ok) {
      toast.success("Saque aprovado");
      loadAll();
    }
  };

  const recusar = async (id: string) => {
    if (!confirm("Recusar este saque?")) return;
    setProcessandoId(id);
    const ok = await atualizarSaque(id, { status: "recusado" });
    setProcessandoId(null);
    if (ok) {
      toast.success("Saque recusado");
      loadAll();
    }
  };

  const marcarPago = async (id: string) => {
    setProcessandoId(id);
    const comp = comprovantes[id];
    if (comp) {
      await atualizarSaque(id, { status: "aprovado", comprovante_url: comp });
    }
    const { error } = await supabase.rpc("processar_saque_pago", { _saque_id: id });
    setProcessandoId(null);
    if (error) {
      toast.error("Erro ao marcar pago: " + error.message);
      return;
    }
    toast.success("Saque pago e splits liquidados");
    loadAll();
  };



  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <h2 className="text-2xl font-bold">Relatório Financeiro</h2>
        <Link
          to="/admin-repasses"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-6 text-sm font-bold text-white shadow-md shadow-brand/20 transition hover:-translate-y-0.5 hover:bg-brand/90 gap-2"
        >
          <Landmark className="h-4 w-4" /> Repasses Pix BTG
        </Link>
      </div>

      {!data && <p className="text-sm text-slate-400">Carregando…</p>}

      {data && (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Total Faturado (Volume)</p>
              <h3 className="text-3xl font-bold">R$ {data.totalFaturado.toFixed(2)}</h3>
              <div className="mt-4 flex items-center gap-1 text-emerald-600 text-xs font-bold">
                <ArrowUpRight className="h-3 w-3" /> {data.pagos.length}{" "}
                {data.pagos.length === 1 ? "pagamento total" : "pagamentos totais"}
              </div>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Lucro da Plataforma (Real)</p>
              <h3 className="text-3xl font-bold text-emerald-600">
                R$ {data.lucroPlataforma.toFixed(2)}
              </h3>
              <div className="mt-4 flex items-center gap-1 text-slate-500 text-xs font-bold">
                Proveniente das comissões
              </div>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-brand">
              <p className="text-sm text-slate-500 mb-1">Saldo Parado BTG (A Repassar)</p>
              <h3 className="text-3xl font-bold">R$ {data.saldoPendenteBtg.toFixed(2)}</h3>
              <div className="mt-4 flex items-center gap-1 text-amber-600 text-xs font-bold">
                <Clock className="h-3 w-3" /> Aguardando transferência Pix
              </div>
            </div>
          </div>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-6 border-b border-slate-100 font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" /> Histórico de Transações
            </div>
            <div className="p-6 space-y-4">
              {data.pagos.length === 0 && (
                <p className="text-sm text-slate-400">Nenhum repasse criado ainda.</p>
              )}
              {data.pagos.slice(0, 10).map((f: any) => (
                <div
                  key={f.id}
                  className="flex justify-between items-center border-b border-slate-50 pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-bold">{f.service_name}</p>
                    <p className="text-xs text-slate-400">
                      #{f.id.slice(0, 8)} ·{" "}
                      {f.data_pagamento
                        ? new Date(f.data_pagamento).toLocaleDateString("pt-BR")
                        : "—"}
                    </p>
                  </div>
                  <p className="font-bold text-slate-900">+ R$ {Number(f.valor || 0).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
