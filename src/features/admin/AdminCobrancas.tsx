import React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface CobrancaPendente {
  orcamento_id: string;
  cliente_nome: string | null;
  cliente_email: string | null;
  profissional_nome: string | null;
  service_name: string | null;
  valor: number | null;
  dias_esperando: number | null;
  cobranca_lembretes_count: number | null;
}

/**
 * Serviços concluídos aguardando pagamento (fluxo pós-serviço). Mostra ao admin
 * quem está devendo, há quantos dias e quantos lembretes automáticos já saíram.
 * Some quando não há nenhuma cobrança pendente.
 */
export function AdminCobrancas() {
  const { data = [], isLoading, refetch, isFetching } = useQuery<CobrancaPendente[]>({
    queryKey: ["admin", "cobrancas-pendentes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vw_cobrancas_pendentes")
        .select("*")
        .order("aguardando_pagamento_desde", { ascending: true });
      if (error) throw error;
      return (data as CobrancaPendente[]) || [];
    },
  });

  if (!isLoading && data.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <h3 className="font-bold text-amber-900 text-sm">
            Serviços concluídos aguardando pagamento ({data.length})
          </h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="space-y-2">
        {data.map((c) => (
          <div
            key={c.orcamento_id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white border border-amber-100 px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <p className="font-bold text-slate-800 truncate">{c.service_name || "Serviço"}</p>
              <p className="text-xs text-slate-500 truncate">
                {c.cliente_nome || "Cliente"}
                {c.cliente_email ? ` · ${c.cliente_email}` : ""}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-slate-800 tabular-nums">{brl(Number(c.valor))}</p>
              <p className="text-[11px] text-amber-700">
                {Math.floor(Number(c.dias_esperando ?? 0))}d esperando ·{" "}
                {c.cobranca_lembretes_count ?? 0}/3 lembretes
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-amber-700/80 mt-3 flex items-center gap-1.5">
        <Bell className="h-3 w-3 shrink-0" />
        Lembretes automáticos saem após 24h e a cada 48h (até 3 vezes). Se precisar, fale direto com o
        cliente pelo e-mail acima.
      </p>
    </div>
  );
}
