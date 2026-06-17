import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function PagamentosTab() {
  const { user } = useAuth();

  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ["cliente", "pagamentos", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("orcamentos")
        .select("id, service_name, valor, status, data_pagamento, created_at")
        .eq("cliente_id", user.id)
        .in("status", ["pago", "concluido"])
        .order("data_pagamento", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  const total = transacoes.reduce((s, t) => s + Number(t.valor || 0), 0);

  const handleExportCSV = () => {
    if (transacoes.length === 0) return;
    const header = "Data,Serviço,Valor (R$),Método de Pagamento,Status\n";
    const rows = transacoes
      .map((t) => {
        const d = t.data_pagamento ? new Date(t.data_pagamento) : new Date(t.created_at);
        const dataStr = d.toLocaleDateString("pt-BR");
        const servico = `"${(t.service_name || "").replace(/"/g, '""')}"`;
        const valor = Number(t.valor || 0).toFixed(2);
        const metodo = "Mercado Pago";
        const status = t.status === "pago" ? "Pago" : t.status === "concluido" ? "Concluído" : t.status;
        return `${dataStr},${servico},${valor},${metodo},${status}`;
      })
      .join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `pagamentos_cliente_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-foreground text-background p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
          <CreditCard className="absolute -right-6 -bottom-6 h-32 w-32 text-white/5" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60 mb-8">
            Total já investido
          </p>
          <div className="space-y-1">
            {isLoading ? (
              <Skeleton className="h-10 w-40 bg-white/10" />
            ) : (
              <p className="text-4xl font-bold tracking-tight">R$ {total.toFixed(2)}</p>
            )}
            <p className="text-sm opacity-60">
              Em {transacoes.length} {transacoes.length === 1 ? "serviço pago" : "serviços pagos"}
            </p>
          </div>
          <div className="mt-10 flex justify-between items-end">
            <p className="font-bold opacity-80">Histórico financeiro</p>
            <CheckCircle2 className="h-6 w-6 opacity-60" />
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-border shadow-soft flex flex-col justify-between">
          <h3 className="font-bold text-lg mb-4">Métodos de pagamento</h3>
          <div className="space-y-4 flex-1">
            <div className="p-4 rounded-xl border border-border bg-slate-50">
              <p className="text-sm font-bold mb-1">Pagamento sob demanda</p>
              <p className="text-xs text-muted-foreground">
                A cobrança é gerada automaticamente a cada orçamento aprovado, no método escolhido
                na tela de checkout (PIX ou cartão).
              </p>
            </div>
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900">
              Pagamentos processados com segurança pelo Mercado Pago. Cartões salvos para pagamento em 1 clique estarão disponíveis em breve.
            </div>
          </div>
        </div>
      </div>

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-xl font-bold">Últimas transações</h3>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full font-bold w-full sm:w-auto"
            onClick={handleExportCSV}
            disabled={transacoes.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
        <div className="bg-white rounded-2xl border border-border shadow-soft divide-y divide-border">
          {isLoading && (
            <div className="p-6 space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          )}
          {!isLoading && transacoes.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum pagamento registrado ainda. Quando você pagar um orçamento, aparecerá aqui.
            </div>
          )}
          {!isLoading &&
            transacoes.map((t) => {
              const d = t.data_pagamento ? new Date(t.data_pagamento) : new Date(t.created_at);
              return (
                <div key={t.id} className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="text-center w-10 shrink-0">
                      <p className="text-xs font-bold text-brand uppercase">
                        {d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                      </p>
                      <p className="text-lg font-bold leading-none">
                        {d.getDate().toString().padStart(2, "0")}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{t.service_name}</p>
                      <p className="text-xs text-muted-foreground">#{t.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <p className="font-bold text-emerald-600 shrink-0">
                    R$ {Number(t.valor || 0).toFixed(2)}
                  </p>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
