import { useEffect, useState } from "react";
import { DollarSign, ShoppingBag, Users, Star, Clock, ArrowUpRight, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Metric = { label: string; value: string; icon: any; color: string; bg: string; targetTab: any };

export function AdminMetrics({ onTabChange }: { onTabChange: (tab: any) => void }) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [recentes, setRecentes] = useState<any[]>([]);
  const [pendentes, setPendentes] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: orcs }, { data: avs }, { count: clientesCount }] = await Promise.all([
        supabase.from("orcamentos").select("id, status, valor, service_name, created_at, cliente_id").order("created_at", { ascending: false }).limit(200),
        supabase.from("avaliacoes").select("nota"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      const list = orcs || [];
      const pagos = list.filter((o: any) => o.status === "pago");
      const receita = pagos.reduce((s: number, o: any) => s + Number(o.valor || 0), 0);
      const ativos = list.filter((o: any) => ["enviado", "aprovado", "customizado_pendente"].includes(o.status)).length;
      const pendingNow = list.filter((o: any) => o.status === "customizado_pendente").length;
      const mediaNota = avs && avs.length > 0
        ? (avs.reduce((s: number, a: any) => s + a.nota, 0) / avs.length).toFixed(1)
        : "—";

      setMetrics([
        { label: "Receita (pagos)", value: `R$ ${receita.toFixed(2)}`, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50", targetTab: "financeiro" },
        { label: "Pedidos Ativos", value: String(ativos), icon: ShoppingBag, color: "text-brand", bg: "bg-brand-soft", targetTab: "pedidos" },
        { label: "Clientes", value: String(clientesCount ?? 0), icon: Users, color: "text-purple-600", bg: "bg-purple-50", targetTab: "clientes" },
        { label: "Avaliação Média", value: `${mediaNota}${avs && avs.length ? "/5" : ""}`, icon: Star, color: "text-amber-600", bg: "bg-amber-50", targetTab: "profissionais" },
      ]);
      setRecentes(list.slice(0, 6));
      setPendentes(pendingNow);
      setLoading(false);
    })();
  }, []);

  const statusCor = (s: string) => {
    switch (s) {
      case "pago": return "bg-emerald-50 text-emerald-700";
      case "aprovado": return "bg-blue-50 text-blue-700";
      case "enviado": return "bg-sky-50 text-sky-700";
      case "customizado_pendente": return "bg-amber-50 text-amber-700";
      case "cancelado": case "recusado": return "bg-red-50 text-red-700";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visão Geral</h1>
          <p className="text-sm text-slate-500 mt-1">{loading ? "Carregando dados…" : "Dados em tempo real do banco."}</p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((stat) => (
          <button
            key={stat.label}
            onClick={() => onTabChange(stat.targetTab)}
            className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand/30 transition-all text-left relative overflow-hidden"
          >
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${stat.bg} ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
            
            <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-brand opacity-0 group-hover:opacity-100 transition-opacity">
              Ver detalhes <ArrowUpRight className="h-3 w-3" />
            </div>

            {/* Subtle background glow on hover */}
            <div className={`absolute -right-4 -bottom-4 h-24 w-24 rounded-full opacity-0 group-hover:opacity-10 transition-opacity blur-2xl ${stat.bg}`} />
          </button>
        ))}
      </div>

      {pendentes > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-amber-900">{pendentes} {pendentes === 1 ? "orçamento aguardando" : "orçamentos aguardando"} atribuição a profissional</p>
            <p className="text-xs text-amber-700">SLA padrão: 4h para resposta inicial.</p>
          </div>
        </div>
      )}

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Últimos Pedidos</h3>
          <Link to="/orcamentos" className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1">
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
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">Nenhum pedido ainda.</td></tr>
              )}
              {recentes.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-xs font-mono text-slate-500">#{o.id.slice(0, 8)}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{o.service_name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusCor(o.status)}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">R$ {Number(o.valor || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-xs text-slate-500 inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {new Date(o.created_at).toLocaleDateString("pt-BR")}
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
