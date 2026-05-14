import React, { useEffect, useState } from "react";
import { ArrowUpRight, Calendar, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function AdminFinanceiro() {
  const [data, setData] = useState<{
    bruto: number;
    liquido: number;
    pendente: number;
    pagos: any[];
  } | null>(null);
  const [comissao] = useState(20);

  useEffect(() => {
    (async () => {
      const { data: orcs } = await supabase
        .from("orcamentos")
        .select(
          "id, status, valor, service_name, created_at, data_pagamento, cliente_id, profissional_id",
        )
        .in("status", ["pago", "aprovado", "enviado"])
        .order("created_at", { ascending: false })
        .limit(100);
      const list = orcs || [];
      const pagos = list.filter((o: any) => o.status === "pago");
      const bruto = pagos.reduce(
        (s: number, o: any) => s + Number(o.valor || 0),
        0,
      );
      const liquido = bruto * (comissao / 100);
      const pendente = list
        .filter((o: any) => ["aprovado", "enviado"].includes(o.status))
        .reduce((s: number, o: any) => s + Number(o.valor || 0), 0);
      setData({ bruto, liquido, pendente, pagos });
    })();
  }, [comissao]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Relatório Financeiro</h2>
      </div>

      {!data && <p className="text-sm text-slate-400">Carregando…</p>}

      {data && (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Volume Bruto (pagos)</p>
              <h3 className="text-3xl font-bold">R$ {data.bruto.toFixed(2)}</h3>
              <div className="mt-4 flex items-center gap-1 text-emerald-600 text-xs font-bold">
                <ArrowUpRight className="h-3 w-3" /> {data.pagos.length}{" "}
                {data.pagos.length === 1 ? "pagamento" : "pagamentos"}
              </div>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Líquido Plataforma</p>
              <h3 className="text-3xl font-bold">R$ {data.liquido.toFixed(2)}</h3>
              <div className="mt-4 flex items-center gap-1 text-slate-500 text-xs font-bold">
                Comissão: {comissao}%
              </div>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 mb-1">
                Aguardando Pagamento
              </p>
              <h3 className="text-3xl font-bold">
                R$ {data.pendente.toFixed(2)}
              </h3>
              <div className="mt-4 flex items-center gap-1 text-amber-600 text-xs font-bold">
                <Clock className="h-3 w-3" /> Aprovados/enviados
              </div>
            </div>
          </div>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-6 border-b border-slate-100 font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" /> Últimos
              pagamentos recebidos
            </div>
            <div className="p-6 space-y-4">
              {data.pagos.length === 0 && (
                <p className="text-sm text-slate-400">
                  Nenhum pagamento ainda.
                </p>
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
                  <p className="font-bold text-emerald-600">
                    + R$ {Number(f.valor || 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
