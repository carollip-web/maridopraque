import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Users, DollarSign, ArrowRight, Clock } from "lucide-react";
import type { DateRange } from "./DateRangeFilter";

type Stats = {
  pedidos: { total: number; pendente: number; enviado: number; aprovado: number; pago: number; concluido: number; cancelado: number };
  profissionais: { total: number; ativos: number; mpConectados: number; mediaAvaliacao: string };
  receita: { totalFaturado: number; comissaoPlataforma: number; receitaApoio: number; ticketMedio: number };
  conversao: { pedidoParaCotacao: number; cotacaoParaAprovacao: number; aprovacaoParaPagamento: number };
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toFixed(1)}%`;

type AdminKPIsProps = {
  dateRange?: DateRange | null;
};

export function AdminKPIs({ dateRange }: AdminKPIsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [orcsRes, profsRes, avsRes, pagsRes] = await Promise.all([
        supabase.from("orcamentos").select("id, status, valor, valor_servico, tipo_atendimento, is_test, created_at").or("is_test.eq.false,is_test.is.null"),
        supabase.from("profissional_perfil").select("user_id, ativo, mp_user_id, aprovacao_status, cadastro_completo"),
        supabase.from("avaliacoes").select("nota, created_at"),
        supabase.from("pagamentos").select("valor_total, status, orcamento_id, created_at"),
      ]);

      let orcs = orcsRes.data || [];
      const profs = profsRes.data || [];
      let avs = avsRes.data || [];
      let pags = pagsRes.data || [];

      // Apply date range filter if provided
      if (dateRange) {
        const from = dateRange.from.getTime();
        const to = dateRange.to.getTime();
        orcs = orcs.filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= from && t <= to;
        });
        avs = avs.filter((a) => {
          const t = new Date(a.created_at).getTime();
          return t >= from && t <= to;
        });
        pags = pags.filter((p) => {
          if (!p.created_at) return false;
          const t = new Date(p.created_at).getTime();
          return t >= from && t <= to;
        });
      }

      // === PEDIDOS ===
      const pedidos = {
        total: orcs.length,
        pendente: orcs.filter(o => o.status === "customizado_pendente").length,
        enviado: orcs.filter(o => o.status === "enviado").length,
        aprovado: orcs.filter(o => o.status === "aprovado").length,
        pago: orcs.filter(o => o.status === "pago").length,
        concluido: orcs.filter(o => o.status === "concluido").length,
        cancelado: orcs.filter(o => o.status === "cancelado").length,
      };

      // === PROFISSIONAIS ===
      // Profissionais are not time-filtered (they are a current snapshot)
      const mediaAvaliacao = avs.length > 0
        ? (avs.reduce((s, a) => s + a.nota, 0) / avs.length).toFixed(1)
        : "—";
      // Só conta profissionais com cadastro completo (exclui testes e pendentes)
      const profsReais = profs.filter((p: any) => p.cadastro_completo === true);
      const profsAprovados = profsReais.filter((p: any) => p.aprovacao_status === "aprovado");
      const profissionais = {
        total: profsReais.length,
        ativos: profsAprovados.filter((p: any) => p.ativo).length,
        mpConectados: profsAprovados.filter((p: any) => p.mp_user_id).length,
        mediaAvaliacao,
      };

      // === RECEITA ===
      const pagosAprovados = pags.filter(p => p.status === "approved" || p.status === "pago");
      const totalFaturado = pagosAprovados.reduce((s, p) => s + Number(p.valor_total || 0), 0);
      const comissaoPlataforma = totalFaturado * 0.15;
      const orcsApoio = orcs.filter(o => o.tipo_atendimento === "homem_com_apoio_feminino" && (o.status === "pago" || o.status === "concluido"));
      const receitaApoio = orcsApoio.reduce((s, o) => s + Number(o.valor || o.valor_servico || 0) * 0.3, 0);
      const ticketMedio = pagosAprovados.length > 0 ? totalFaturado / pagosAprovados.length : 0;

      const receita = { totalFaturado, comissaoPlataforma, receitaApoio, ticketMedio };

      // === CONVERSÃO ===
      const passouDe = (status: string) => {
        const statusOrder = ["customizado_pendente", "enviado", "aprovado", "pago", "concluido"];
        const idx = statusOrder.indexOf(status);
        return orcs.filter(o => statusOrder.indexOf(o.status) >= idx).length;
      };
      const cotados = passouDe("enviado");
      const aprovados = passouDe("aprovado");
      const pagos = passouDe("pago");

      const conversao = {
        pedidoParaCotacao: pedidos.total > 0 ? (cotados / pedidos.total) * 100 : 0,
        cotacaoParaAprovacao: cotados > 0 ? (aprovados / cotados) * 100 : 0,
        aprovacaoParaPagamento: aprovados > 0 ? (pagos / aprovados) * 100 : 0,
      };

      setStats({ pedidos, profissionais, receita, conversao });
      setLoading(false);
    })();
  }, [dateRange]);

  if (loading) return <div className="p-8 text-slate-500">Carregando KPIs...</div>;
  if (!stats) return <div className="p-8 text-slate-500">Erro ao carregar.</div>;

  const { pedidos, profissionais, receita, conversao } = stats;

  const Card = ({ label, value, sub, color = "text-slate-800" }: { label: string; value: string; sub?: string; color?: string }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );

  const FunnelStep = ({ label, value, rate }: { label: string; value: number; rate?: number }) => (
    <div className="flex items-center gap-3">
      <div className="flex-1 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-xl font-black text-slate-800">{value}</p>
      </div>
      {rate !== undefined && (
        <div className="flex flex-col items-center">
          <ArrowRight className="h-4 w-4 text-slate-300" />
          <span className="text-[10px] font-bold text-emerald-600">{pct(rate)}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-1">KPIs Operacionais</h2>
        <p className="text-slate-500 text-sm">
          {dateRange
            ? `Dados filtrados do período selecionado (excluindo testes).`
            : `Visão consolidada da operação (todos os dados, excluindo testes).`
          }
        </p>
      </div>

      {/* PEDIDOS */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4" /> Pedidos
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card label="Total" value={String(pedidos.total)} />
          <Card label="Pendentes" value={String(pedidos.pendente)} color="text-amber-600" />
          <Card label="Cotados" value={String(pedidos.enviado)} color="text-blue-600" />
          <Card label="Aprovados" value={String(pedidos.aprovado)} color="text-indigo-600" />
          <Card label="Pagos" value={String(pedidos.pago)} color="text-emerald-600" />
          <Card label="Concluídos" value={String(pedidos.concluido)} color="text-green-700" />
          <Card label="Cancelados" value={String(pedidos.cancelado)} color="text-red-500" />
        </div>
      </section>

      {/* FUNIL DE CONVERSÃO */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Funil de Conversão
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500 mb-1">Pedido → Cotação</p>
            <p className="text-3xl font-black text-emerald-600">{pct(conversao.pedidoParaCotacao)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Profissional respondeu o pedido</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500 mb-1">Cotação → Aprovação</p>
            <p className="text-3xl font-black text-blue-600">{pct(conversao.cotacaoParaAprovacao)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Cliente aceitou a proposta</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500 mb-1">Aprovação → Pagamento</p>
            <p className="text-3xl font-black text-indigo-600">{pct(conversao.aprovacaoParaPagamento)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Cliente pagou o serviço</p>
          </div>
        </div>
      </section>

      {/* PROFISSIONAIS */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
          <Users className="h-4 w-4" /> Profissionais
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="Cadastros Completos" value={String(profissionais.total)} />
          <Card label="Ativos" value={String(profissionais.ativos)} color="text-emerald-600" />
          <Card label="MP Conectado" value={String(profissionais.mpConectados)} color={profissionais.mpConectados > 0 ? "text-blue-600" : "text-red-500"} sub={profissionais.mpConectados === 0 ? "Nenhum! Bloqueador nº 1" : ""} />
          <Card label="Média Avaliações" value={profissionais.mediaAvaliacao} color="text-amber-600" />
        </div>
      </section>

      {/* RECEITA */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Receita
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="Total Faturado" value={brl(receita.totalFaturado)} color="text-emerald-700" />
          <Card label="Comissão (15%)" value={brl(receita.comissaoPlataforma)} color="text-blue-600" sub="Retido pela plataforma" />
          <Card label="Receita Apoio Fem." value={brl(receita.receitaApoio)} color="text-purple-600" sub="30% do serviço (repasse PIX)" />
          <Card label="Ticket Médio" value={brl(receita.ticketMedio)} sub="Por pagamento" />
        </div>
      </section>
    </div>
  );
}
