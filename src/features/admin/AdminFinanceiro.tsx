import React, { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Calendar, Clock, Landmark, Wallet, CheckCircle2, Loader2, CreditCard, Users } from "lucide-react";
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
    totalApoioFeminino: number;
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
    // Nova consulta para pagamentos do Mercado Pago (Split 1:1)
    const { data: pgs } = await supabase
      .from("pagamentos")
      .select(`
        id, status, valor_total, created_at, gateway, metadata,
        orcamentos ( service_name, data_pagamento )
      `)
      .eq("gateway", "mercado_pago")
      .order("created_at", { ascending: false })
      .limit(200);

    const list = pgs || [];
    const totalFaturado = list.reduce((s: number, r: any) => s + Number(r.valor_total || 0), 0);
    
    let totalApoioFeminino = 0;
    
    const lucroPlataforma = list
      .filter((r: any) => r.status === "paid" || r.status === "approved")
      .reduce((s: number, r: any) => {
        const fee = (r.metadata as any)?.marketplace_fee_amount || 0;
        const apoioFemininoCut = (r.metadata as any)?.valor_apoio_feminino || 0;
        totalApoioFeminino += Number(apoioFemininoCut);
        return s + Number(fee) - Number(apoioFemininoCut);
      }, 0);
    const saldoPendenteBtg = list
      .filter((r: any) => r.status === "pending")
      .reduce((s: number, r: any) => s + Number(r.valor_total || 0), 0);

    const pagos = list.map((r: any) => ({
      id: r.id,
      service_name: r.orcamentos?.service_name || "Serviço",
      data_pagamento: r.orcamentos?.data_pagamento || r.created_at,
      valor: r.valor_total,
      fee: (r.metadata as any)?.marketplace_fee_amount || 0,
      status: r.status,
    }));
    
    setData({ totalFaturado, lucroPlataforma, saldoPendenteBtg, totalApoioFeminino, pagos });

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
          <CreditCard className="h-4 w-4" /> Pagamentos MP
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
            <div className="flex flex-col gap-6">
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-500 mb-1">Lucro Plataforma</p>
                <h3 className="text-3xl font-bold text-emerald-600">
                  R$ {data.lucroPlataforma.toFixed(2)}
                </h3>
                <div className="mt-4 flex items-center gap-1 text-slate-500 text-xs font-bold">
                  Taxas retidas
                </div>
              </div>

              {data.totalApoioFeminino > 0 && (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-pink-500">
                  <p className="text-sm text-slate-500 mb-1">Repasses Apoio Feminino</p>
                  <h3 className="text-3xl font-bold text-pink-600">
                    R$ {data.totalApoioFeminino.toFixed(2)}
                  </h3>
                  <div className="mt-4 flex items-center gap-1 text-slate-500 text-xs font-bold">
                    Retidos via Mercado Pago
                  </div>
                </div>
              )}
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-brand">
              <p className="text-sm text-slate-500 mb-1">Pagamentos Pendentes (MP)</p>
              <h3 className="text-3xl font-bold">R$ {data.saldoPendenteBtg.toFixed(2)}</h3>
              <div className="mt-4 flex items-center gap-1 text-amber-600 text-xs font-bold">
                <Clock className="h-3 w-3" /> Aguardando pagamento
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{f.service_name}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        f.status === 'paid' || f.status === 'approved' ? 'bg-emerald-100 text-emerald-700'
                        : f.status === 'pending' ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                        {f.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      #{f.id.slice(0, 8)} ·{" "}
                      {f.data_pagamento
                        ? new Date(f.data_pagamento).toLocaleDateString("pt-BR")
                        : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">+ R$ {Number(f.valor || 0).toFixed(2)}</p>
                    {f.fee > 0 && (
                      <p className="text-[10px] text-brand font-medium mt-0.5">Fee: R$ {Number(f.fee).toFixed(2)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {ledger && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1 flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5"/> Total recebido (ledger)</p>
            <h3 className="text-2xl font-bold">{brl(ledger.totalRecebido)}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">Taxas da plataforma</p>
            <h3 className="text-2xl font-bold text-emerald-600">{brl(ledger.totalTaxa)}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-amber-400">
            <p className="text-sm text-slate-500 mb-1">A pagar aos profissionais</p>
            <h3 className="text-2xl font-bold">{brl(ledger.totalAPagar)}</h3>
          </div>
        </div>
      )}

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-100 font-bold flex items-center gap-2">
          <Landmark className="h-4 w-4 text-brand" /> Saques solicitados
        </div>
        <div className="p-6 space-y-3">
          {saques.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum saque solicitado.</p>
          )}
          {saques.map((s) => {
            const isFinal = s.status === "pago" || s.status === "recusado" || s.status === "cancelado";
            return (
              <div key={s.id} className="border border-slate-100 rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{s.profissional_nome || "Profissional"}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(s.solicitado_em).toLocaleString("pt-BR")} · Pix: {s.chave_pix || "—"}
                    </p>
                    {s.observacao && (
                      <p className="text-xs text-slate-500 mt-1">Obs: {s.observacao}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold tabular-nums">{brl(Number(s.valor))}</p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                      s.status === "pago" ? "bg-emerald-100 text-emerald-700"
                      : s.status === "solicitado" ? "bg-amber-100 text-amber-700"
                      : s.status === "aprovado" ? "bg-sky-100 text-sky-700"
                      : "bg-slate-100 text-slate-700"
                    }`}>{s.status}</span>
                  </div>
                </div>

                {!isFinal && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="URL do comprovante (opcional)"
                      value={comprovantes[s.id] ?? s.comprovante_url ?? ""}
                      onChange={(e) => setComprovantes((m) => ({ ...m, [s.id]: e.target.value }))}
                      className="text-xs"
                    />
                    {s.status === "solicitado" && (
                      <Button size="sm" variant="outline" onClick={() => aprovar(s.id)} disabled={processandoId === s.id}>
                        Aprovar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => marcarPago(s.id)}
                      disabled={processandoId === s.id}
                    >
                      {processandoId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle2 className="h-3.5 w-3.5"/>}
                      <span className="ml-1">Marcar pago</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => recusar(s.id)} disabled={processandoId === s.id}>
                      Recusar
                    </Button>
                  </div>
                )}
                {s.comprovante_url && (
                  <a href={s.comprovante_url} target="_blank" rel="noreferrer" className="text-xs text-brand underline mt-2 inline-block">
                    Ver comprovante
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
