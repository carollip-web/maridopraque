import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  RefreshCw,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Calendar,
  User,
  Copy,
  Check,
  Inbox,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { AdminApoioFemininoRepasses } from "@/features/admin/AdminApoioFemininoRepasses";

const TAXA_MP_CREDITO = 0.0549; // 5,49% para crédito à vista — fonte: mercadopago.com.br/costs-section

type PagamentoRow = Database["public"]["Tables"]["pagamentos"]["Row"] & {
  orcamentos?: { service_name: string | null } | null;
};

export const Route = createFileRoute("/admin-repasses")({
  component: AdminPagamentosPage,
  head: () => ({ meta: [{ title: "Pagamentos MP · Marido pra Quê?" }] }),
});

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  pending: {
    bg: "bg-amber-50 border-amber-200 text-amber-700",
    text: "text-amber-700",
    label: "Pendente",
  },
  paid: {
    bg: "bg-emerald-50 border-emerald-200 text-emerald-700",
    text: "text-emerald-700",
    label: "Pago",
  },
  approved: {
    bg: "bg-indigo-50 border-indigo-200 text-indigo-700",
    text: "text-indigo-700",
    label: "Aprovado",
  },
  failed: { bg: "bg-red-50 border-red-200 text-red-700", text: "text-red-700", label: "Falhou" },
  cancelled: {
    bg: "bg-slate-100 border-slate-200 text-slate-600",
    text: "text-slate-600",
    label: "Cancelado",
  },
};

function AdminPagamentosPage() {
  const { isLoggedIn, adminLevel, loading: authLoading } = useAuth();
  const [pagamentos, setPagamentos] = useState<PagamentoRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { nome: string; email: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<"mp" | "apoio">("mp");

  // Filtros e busca
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");

  const hasAccess =
    isLoggedIn &&
    (adminLevel === "admin" || adminLevel === "super_admin" || adminLevel === "financeiro");

  const loadData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*, orcamentos!pagamentos_orcamento_id_fkey(service_name)")
        .eq("gateway", "mercado_pago")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const list = (data || []) as unknown as PagamentoRow[];
      setPagamentos(list);

      // Buscar perfis dos profissionais e clientes de forma otimizada
      const userIds = Array.from(
        new Set([
          ...list.map((r) => r.profissional_id).filter(Boolean) as string[],
          ...list.map((r) => r.cliente_id).filter(Boolean) as string[],
        ]),
      );

      if (userIds.length > 0) {
        const { data: profsData, error: profsErr } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", userIds);

        if (!profsErr && profsData) {
          const profMap: Record<string, { nome: string; email: string | null }> = {};
          profsData.forEach((p) => {
            profMap[p.id] = { nome: p.nome, email: p.email };
          });
          setProfiles(profMap);
        }
      }
    } catch (err: any) {
      console.error("[loadData] Erro ao carregar pagamentos:", err);
      toast.error("Erro ao carregar a lista de pagamentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!hasAccess) {
      toast.error("Acesso restrito ao departamento financeiro.");
      return;
    }
    loadData();
  }, [authLoading, hasAccess]);

  // Cópia para área de transferência
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success("Copiado com sucesso!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtragem e busca
  const filteredPagamentos = useMemo(() => {
    return pagamentos.filter((r) => {
      // 'approved' e 'paid' contam como o mesmo filtro lógico 'paid' para simplificar
      const matchStatus = 
        selectedStatus === "todos" || 
        r.status === selectedStatus || 
        (selectedStatus === "paid" && r.status === "approved");

      const profName = r.profissional_id ? (profiles[r.profissional_id]?.nome || "").toLowerCase() : "";
      const cliName = r.cliente_id ? (profiles[r.cliente_id]?.nome || "").toLowerCase() : "";
      const srvName = (r.orcamentos?.service_name || "").toLowerCase();
      const query = searchQuery.toLowerCase();

      const matchesSearch =
        profName.includes(query) ||
        cliName.includes(query) ||
        srvName.includes(query) ||
        r.id.toLowerCase().includes(query);

      return matchStatus && matchesSearch;
    });
  }, [pagamentos, selectedStatus, searchQuery, profiles]);

  // Extrai a taxa de marketplace (application_fee) do pagamento.
  // Ordem: campo direto → fee_details do webhook → fallback 15% do valor_total.
  const getMarketplaceFee = (r: any): number => {
    const meta = r?.metadata as any;
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
  };

  // Métricas rápidas no topo
  const metrics = useMemo(() => {
    // Apenas pagamentos efetivamente aprovados entram no volume bruto
    const pagamentosAprovados = pagamentos.filter(
      (r) => r.status === "approved" || r.status === "paid" || r.status === "pago",
    );
    const brutoTotal = pagamentosAprovados.reduce((acc, r) => acc + Number(r.valor_total || 0), 0);
    const comissaoTotal = pagamentosAprovados.reduce((acc, r) => acc + getMarketplaceFee(r), 0);
    const pendenteTotal = pagamentos
      .filter((r) => r.status === "pending")
      .reduce((acc, r) => acc + Number(r.valor_total || 0), 0);
    const pagoTotal = brutoTotal - comissaoTotal; // líquido repassado ao profissional

    return { brutoTotal, comissaoTotal, pendenteTotal, pagoTotal };
  }, [pagamentos]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Carregando painel de pagamentos...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-6">
          <div className="h-16 w-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
            <XCircle className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Acesso restrito ao financeiro</h1>
          <p className="text-slate-500">
            Você não possui permissões necessárias para acessar este painel.
          </p>
          <Link
            to="/"
            className="inline-flex h-12 items-center justify-center w-full rounded-full bg-foreground text-background font-bold hover:bg-foreground/90 transition"
          >
            Voltar ao Início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      {/* Header com degradê premium */}
      <header className="bg-[#0F172A] text-white py-12 px-4 md:px-8 border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <Link
              to="/admin"
              search={{ tab: "financeiro" } as any}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Financeiro
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl flex items-center gap-3">
              Pagamentos MP{" "}
              <span className="text-xs bg-brand/20 text-brand px-3 py-1 rounded-full uppercase tracking-wider border border-brand/30 flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" /> Split Automático
              </span>
            </h1>
            <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
              Os repasses aos profissionais são feitos automaticamente pelo Mercado Pago (1:1).
              Sua comissão (15%) é retida no ato do pagamento.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 self-start md:self-auto">
            <Button
              onClick={loadData}
              variant="outline"
              className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700 font-bold gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar Tabela
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6">
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab("mp")}
            className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors ${
              activeTab === "mp"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Transações MP (Split Automático)
          </button>
          <button
            onClick={() => setActiveTab("apoio")}
            className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors ${
              activeTab === "apoio"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Repasses PIX (Apoio Feminino)
          </button>
        </div>
        
        {activeTab === "apoio" ? (
          <AdminApoioFemininoRepasses />
        ) : (
          <div className="space-y-8">
            {/* Cards de Métricas Premium */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Volume Bruto Total
              </p>
              <h3 className="text-2xl font-black text-slate-900">
                R${" "}
                {metrics.brutoTotal.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-1 text-slate-500 text-xs font-bold">
              <DollarSign className="h-3.5 w-3.5" /> Transacionado no gateway
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Comissão Retida (MP)
              </p>
              <h3 className="text-2xl font-black text-slate-900">
                R${" "}
                {metrics.comissaoTotal.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-1 text-brand text-xs font-bold">
              <TrendingUp className="h-3.5 w-3.5 animate-pulse" /> Taxa de marketplace já paga
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between border-l-4 border-l-amber-400">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Pagamentos Pendentes
              </p>
              <h3 className="text-2xl font-black text-amber-600">
                R${" "}
                {metrics.pendenteTotal.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-1 text-amber-600 text-xs font-bold">
              <AlertTriangle className="h-3.5 w-3.5" /> Aguardando cliente pagar
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between border-l-4 border-l-emerald-500">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Pagamentos Concluídos
              </p>
              <h3 className="text-2xl font-black text-emerald-600">
                R${" "}
                {metrics.pagoTotal.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-1 text-emerald-600 text-xs font-bold">
              <CheckCircle className="h-3.5 w-3.5" /> Repassados ao profissional
            </div>
          </div>
        </div>

        {/* Área de Filtros e Busca */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Abas de Filtros de Status */}
            <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-xl self-start">
              {[
                { id: "todos", label: "Todos" },
                { id: "pending", label: "Pendentes" },
                { id: "paid", label: "Pagos" },
                { id: "failed", label: "Falharam" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedStatus(item.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    selectedStatus === item.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Input de Busca */}
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar profissional, serviço, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20 text-sm transition"
              />
            </div>
          </div>

          {/* Tabela de Pagamentos */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400 font-medium">Buscando dados no Supabase...</p>
            </div>
          ) : filteredPagamentos.length === 0 ? (
            <div className="py-20 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                <Inbox className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800">Nenhum pagamento encontrado</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Não localizamos nenhum registro com os filtros aplicados.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider bg-slate-50/50">
                    <th className="px-6 py-4">ID / Criação</th>
                    <th className="px-6 py-4">Serviço / Profissional</th>
                    <th className="px-6 py-4 text-right">Valor Total</th>
                    <th className="px-6 py-4 text-right">Fee (15%)</th>
                    <th className="px-6 py-4 text-right">Taxa MP (est.)</th>
                    <th className="px-6 py-4 text-right">Líquido Pro</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPagamentos.map((pag) => {
                    const prof = pag.profissional_id ? profiles[pag.profissional_id] : null;
                    const badge = STATUS_BADGES[pag.status] || {
                      bg: "bg-slate-100",
                      text: "text-slate-700",
                      label: pag.status,
                    };
                    
                    const fee = getMarketplaceFee(pag);
                    const liquido = Number(pag.valor_total || 0) - fee;

                    return (
                      <tr key={pag.id} className="hover:bg-slate-50/40 transition group">
                        {/* ID e Criação */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-slate-500">
                              #{pag.id.slice(0, 8)}
                            </span>
                            <button
                              onClick={() => handleCopy(pag.id)}
                              className="text-slate-400 hover:text-slate-900 transition"
                              title="Copiar ID completo"
                            >
                              {copiedId === pag.id ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                              )}
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 font-medium">
                            <Calendar className="h-3 w-3" />
                            {pag.created_at ? new Date(pag.created_at).toLocaleString("pt-BR") : "—"}
                          </div>
                        </td>

                        {/* Profissional e Serviço */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                            {pag.orcamentos?.service_name || "Serviço"}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            {prof?.nome || "Não informado"}
                          </div>
                        </td>

                        {/* Valor Total */}
                        <td className="px-6 py-4 text-right">
                          <div className="font-black text-sm text-slate-900">
                            R${" "}
                            {Number(pag.valor_total).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                        </td>
                        
                        {/* Fee Marketplace */}
                        <td className="px-6 py-4 text-right">
                          <div className="font-bold text-sm text-brand">
                            {fee > 0 ? (
                               `R$ ${Number(fee).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}`
                            ) : (
                               <span className="text-slate-300">—</span>
                            )}
                          </div>
                        </td>

                        {/* Líquido Pro */}
                        <td className="px-6 py-4 text-right">
                          <div className="font-bold text-sm text-emerald-600">
                             R${" "}
                             {Number(liquido).toLocaleString("pt-BR", {
                               minimumFractionDigits: 2,
                             })}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}
      </div>
    </div>
  );
}
