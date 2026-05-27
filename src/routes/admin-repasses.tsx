import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  Wrench,
  Inbox,
  Link2,
  Loader2,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Repasse = Database["public"]["Tables"]["repasses_profissionais"]["Row"] & {
  orcamentos?: { status: string } | null;
};

export const Route = createFileRoute("/admin-repasses")({
  component: AdminRepassesPage,
  head: () => ({ meta: [{ title: "Fila de Repasses · Marido pra Quê?" }] }),
});

function maskDocument(doc: string | null): string {
  if (!doc) return "—";
  const clean = doc.replace(/\D/g, "");
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}.***.***-${clean.slice(9)}`;
  } else if (clean.length === 14) {
    return `${clean.slice(0, 2)}.***.***/${clean.slice(8, 12)}-${clean.slice(12)}`;
  }
  return doc;
}

function maskPixKey(key: string | null, type: string | null): string {
  if (!key) return "—";
  if (type === "cpf" || type === "cnpj") {
    return maskDocument(key);
  }
  if (type === "email") {
    const parts = key.split("@");
    if (parts.length === 2) {
      const name = parts[0];
      const domain = parts[1];
      if (name.length > 2) {
        return `${name.slice(0, 2)}***@${domain}`;
      }
      return `***@${domain}`;
    }
  }
  if (type === "phone") {
    const clean = key.replace(/\D/g, "");
    if (clean.length >= 10) {
      return `(${clean.slice(0, 2)}) 9****-${clean.slice(-4)}`;
    }
  }
  if (key.length > 10) {
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }
  return key;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  pendente: {
    bg: "bg-amber-50 border-amber-200 text-amber-700",
    text: "text-amber-700",
    label: "Pendente",
  },
  aprovado: {
    bg: "bg-indigo-50 border-indigo-200 text-indigo-700",
    text: "text-indigo-700",
    label: "Aprovado",
  },
  processando: {
    bg: "bg-blue-50 border-blue-200 text-blue-700",
    text: "text-blue-700",
    label: "Processando",
  },
  enviado: { bg: "bg-sky-50 border-sky-200 text-sky-700", text: "text-sky-700", label: "Enviado" },
  pago: {
    bg: "bg-emerald-50 border-emerald-200 text-emerald-700",
    text: "text-emerald-700",
    label: "Pago",
  },
  falhou: { bg: "bg-red-50 border-red-200 text-red-700", text: "text-red-700", label: "Falhou" },
  cancelado: {
    bg: "bg-slate-100 border-slate-200 text-slate-600",
    text: "text-slate-600",
    label: "Cancelado",
  },
};

function AdminRepassesPage() {
  const { isLoggedIn, adminLevel, loading: authLoading } = useAuth();
  const [repasses, setRepasses] = useState<Repasse[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { nome: string; email: string | null }>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Estado BTG
  const [btgStatus, setBtgStatus] = useState<{
    connected: boolean;
    connectedAt: string | null;
  } | null>(null);
  const [btgLoading, setBtgLoading] = useState(true);
  const [btgConnecting, setBtgConnecting] = useState(false);

  // Filtros e busca
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Seleção em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const navigate = useNavigate();

  const hasAccess =
    isLoggedIn &&
    (adminLevel === "admin" || adminLevel === "super_admin" || adminLevel === "financeiro");
  const canConnectBtg = adminLevel === "super_admin" || adminLevel === "financeiro";

  const loadData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("repasses_profissionais")
        .select("*, orcamentos(status)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const list = (data || []) as unknown as Repasse[];
      setRepasses(list);

      // Buscar perfis dos profissionais e clientes de forma otimizada
      const userIds = Array.from(
        new Set([
          ...list.map((r) => r.profissional_id),
          ...(list.map((r) => r.cliente_id).filter(Boolean) as string[]),
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
      console.error("[loadData] Erro ao carregar repasses:", err);
      toast.error("Erro ao carregar a lista de repasses.");
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
    loadBtgStatus();
  }, [authLoading, hasAccess]);

  // Ações de alteração de status
  const handleAprovar = async (repasse: Repasse) => {
    try {
      setApprovingId(repasse.id);

      const { data, error } = await supabase.functions.invoke("btg-repasse-disparar", {
        body: { repasse_ids: [repasse.id] },
      });

      if (error) {
        throw new Error(error.message || "Erro desconhecido na chamada da Edge Function");
      }

      if (data && data.error) {
        throw new Error(data.error);
      }

      toast.success("Pagamento via Pix iniciado com sucesso!");
      loadData();
    } catch (err: any) {
      console.error("[handleAprovar] Erro:", err);
      toast.error(err.message || "Falha ao iniciar pagamento via BTG.");
    } finally {
      setApprovingId(null);
    }
  };

  // Aprovação em lote (bulk PIX BTG)
  const handleAprovarSelecionados = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.warning("Selecione ao menos um repasse pendente liberado.");
      return;
    }
    if (!btgStatus?.connected) {
      toast.error("Conecte a conta BTG antes de disparar repasses.");
      return;
    }
    const ok = window.confirm(
      `Confirmar disparo via PIX BTG de ${ids.length} repasse(s)? Esta ação é irreversível.`,
    );
    if (!ok) return;

    try {
      setBulkProcessing(true);
      const { data, error } = await supabase.functions.invoke("btg-repasse-disparar", {
        body: { repasse_ids: ids },
      });
      if (error) throw new Error(error.message || "Erro na Edge Function");
      if (data?.error) throw new Error(data.error);

      const sucessos = Array.isArray(data?.results)
        ? data.results.filter((r: any) => r.success).length
        : ids.length;
      const falhas = ids.length - sucessos;
      if (falhas === 0) {
        toast.success(`${sucessos} repasse(s) enviados ao BTG.`);
      } else {
        toast.warning(`${sucessos} ok, ${falhas} falharam. Verifique a fila.`);
      }
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      console.error("[handleAprovarSelecionados]", err);
      toast.error(err.message || "Falha ao disparar repasses em lote.");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleCancelar = async (id: string) => {
    try {
      const { error } = await supabase
        .from("repasses_profissionais")
        .update({
          status: "cancelado",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Repasse cancelado.");
      loadData();
    } catch (err: any) {
      console.error("[handleCancelar] Erro:", err);
      toast.error("Falha ao cancelar o repasse.");
    }
  };

  const handleReabrir = async (id: string) => {
    try {
      const { error } = await supabase
        .from("repasses_profissionais")
        .update({
          status: "pendente",
          erro: null,
          failed_at: null,
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Repasse reaberto como pendente!");
      loadData();
    } catch (err: any) {
      console.error("[handleReabrir] Erro:", err);
      toast.error("Falha ao reabrir o repasse.");
    }
  };

  // Marcar repasse como pago manualmente
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const handleMarcarPago = async (repasse: Repasse) => {
    const profName = profiles[repasse.profissional_id]?.nome || "profissional";
    const ok = window.confirm(
      `Você confirmou o Pix manual pra ${profName}?\n\nValor líquido: R$ ${Number(repasse.valor_liquido).toFixed(2)}\nChave Pix: ${repasse.pix_key || "—"}`,
    );
    if (!ok) return;

    try {
      setMarkingPaidId(repasse.id);
      const { error } = await supabase
        .from("repasses_profissionais")
        .update({
          status: "pago",
          paid_at: new Date().toISOString(),
        })
        .eq("id", repasse.id);

      if (error) throw error;
      toast.success(`Repasse para ${profName} marcado como pago!`);
      loadData();
    } catch (err: any) {
      console.error("[handleMarcarPago]", err);
      toast.error(err.message || "Falha ao marcar repasse como pago.");
    } finally {
      setMarkingPaidId(null);
    }
  };

  // Cópia para área de transferência
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success("Copiado com sucesso!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Carregar status da conta BTG
  const loadBtgStatus = async () => {
    setBtgLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("marketplace_integracoes")
        .select("connected_at, access_token")
        .eq("provider", "btg")
        .maybeSingle();
      setBtgStatus({
        connected: !!(data?.connected_at && data?.access_token),
        connectedAt: data?.connected_at ?? null,
      });
    } catch {
      setBtgStatus({ connected: false, connectedAt: null });
    } finally {
      setBtgLoading(false);
    }
  };

  // Iniciar fluxo OAuth BTG
  const handleConnectBtg = async () => {
    setBtgConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("btg-oauth-start");
      if (error) throw error;
      if (!data?.authUrl) throw new Error("URL de autorização não retornada pelo servidor");
      window.location.href = data.authUrl;
    } catch (err: any) {
      console.error("[handleConnectBtg]", err);
      toast.error(err?.message ?? "Falha ao iniciar conexão com BTG Pactual");
    } finally {
      setBtgConnecting(false);
    }
  };

  // Sincronizar status com BTG
  const [syncingStatus, setSyncingStatus] = useState(false);
  const handleSyncStatus = async () => {
    try {
      setSyncingStatus(true);
      const { data, error } = await supabase.functions.invoke("btg-repasse-status-sync");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.results?.length === 0) {
        toast.info(data.message || "Nenhum repasse pendente encontrado.");
      } else {
        const sucessos = data.results.filter((r: any) => r.success).length;
        toast.success(`Sincronizado status de ${sucessos} repasses.`);
      }
      loadData();
    } catch (err: any) {
      console.error("[handleSyncStatus]", err);
      toast.error(err?.message ?? "Falha ao sincronizar status com BTG");
    } finally {
      setSyncingStatus(false);
    }
  };

  // Filtragem e busca
  const filteredRepasses = useMemo(() => {
    return repasses.filter((r) => {
      const matchesStatus = selectedStatus === "todos" || r.status === selectedStatus;

      const profName = (profiles[r.profissional_id]?.nome || "").toLowerCase();
      const cliName = (r.cliente_id ? profiles[r.cliente_id]?.nome || "" : "").toLowerCase();
      const pixKey = (r.pix_key || "").toLowerCase();
      const doc = (r.pix_holder_document || "").toLowerCase();
      const query = searchQuery.toLowerCase();

      const matchesSearch =
        profName.includes(query) ||
        cliName.includes(query) ||
        pixKey.includes(query) ||
        doc.includes(query) ||
        r.id.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [repasses, selectedStatus, searchQuery, profiles]);

  // Métricas rápidas no topo
  const metrics = useMemo(() => {
    const list = repasses;
    const brutoTotal = list.reduce((acc, r) => acc + Number(r.valor_bruto), 0);
    const comissaoTotal = list.reduce((acc, r) => acc + Number(r.valor_comissao_marketplace), 0);
    const pendenteLiquido = list
      .filter((r) => ["pendente", "aprovado", "processando"].includes(r.status))
      .reduce((acc, r) => acc + Number(r.valor_liquido), 0);
    const pagoLiquido = list
      .filter((r) => r.status === "pago")
      .reduce((acc, r) => acc + Number(r.valor_liquido), 0);

    return { brutoTotal, comissaoTotal, pendenteLiquido, pagoLiquido };
  }, [repasses]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Carregando painel de repasses...</p>
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
            Você não possui permissões necessárias para acessar a fila de repasses do BTG Pactual.
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
              Fila de Repasses{" "}
              <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full uppercase tracking-wider border border-amber-500/30">
                Repasse Manual
              </span>
            </h1>
            <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
              Consulte, valide e libere de forma manual e segura os repasses aos profissionais
              parceiros. Pagamentos recebidos via Mercado Pago — repasse manual via Pix.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 self-start md:self-auto">
            <Button
              onClick={handleSyncStatus}
              disabled={syncingStatus}
              className="bg-brand text-white hover:bg-brand/90 font-bold gap-2"
            >
              {syncingStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Consultar status BTG
            </Button>
            <Button
              onClick={loadData}
              variant="outline"
              className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700 font-bold gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar Fila
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-10 space-y-8">
        {/* Card Conta BTG do Marketplace */}
        {canConnectBtg && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    btgStatus?.connected
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                    Conta BTG Pactual do Marketplace
                  </p>
                  {btgLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando status...
                    </div>
                  ) : btgStatus?.connected ? (
                    <div>
                      <p className="text-sm font-bold text-emerald-700">✓ Conectado</p>
                      {btgStatus.connectedAt && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          em {new Date(btgStatus.connectedAt).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-slate-500">Não conectado</p>
                  )}
                </div>
              </div>
              <Button
                onClick={handleConnectBtg}
                disabled={btgConnecting || btgLoading}
                className="bg-[#0F172A] hover:bg-slate-700 text-white font-bold gap-2 rounded-xl px-5 self-start sm:self-auto"
              >
                {btgConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Iniciando...
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" /> Conectar conta BTG
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

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
              <DollarSign className="h-3.5 w-3.5" /> Total em pagamentos
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Comissão Plataforma
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
              <TrendingUp className="h-3.5 w-3.5 animate-pulse" /> Taxa de intermediação
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Líquido Pendente
              </p>
              <h3 className="text-2xl font-black text-amber-600">
                R${" "}
                {metrics.pendenteLiquido.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-1 text-amber-600 text-xs font-bold">
              <AlertTriangle className="h-3.5 w-3.5" /> Aguardando liberação
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Líquido Pago
              </p>
              <h3 className="text-2xl font-black text-emerald-600">
                R${" "}
                {metrics.pagoLiquido.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-1 text-emerald-600 text-xs font-bold">
              <CheckCircle className="h-3.5 w-3.5" /> Transferências concluídas
            </div>
          </div>
        </div>

        {/* ===== SEÇÃO: Repasses Pendentes (Manual) ===== */}
        {(() => {
          const pendentes = repasses.filter((r) => r.status === "pendente");
          const totalPendente = pendentes.reduce((acc, r) => acc + Number(r.valor_liquido), 0);
          if (pendentes.length === 0) return null;
          return (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-lg">Repasses Pendentes (Manual)</h3>
                    <p className="text-xs text-slate-500">{pendentes.length} repasse(s) aguardando Pix manual</p>
                  </div>
                </div>
                <div className="bg-white border border-amber-200 rounded-xl px-5 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total a pagar</p>
                  <p className="text-2xl font-black text-amber-600">
                    R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pendentes.map((rep) => {
                  const prof = profiles[rep.profissional_id];
                  return (
                    <div
                      key={rep.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-3 hover:border-brand/30 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            {prof?.nome || "Profissional"}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Orçamento #{rep.orcamento_id?.slice(0, 8) || "—"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-lg text-slate-900">
                            R$ {Number(rep.valor_liquido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-slate-400">líquido</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wide">
                            {rep.pix_key_type || "—"}
                          </span>
                          <span className="font-mono text-slate-700">
                            {rep.pix_key || "Chave Pix não informada"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Calendar className="h-3 w-3" />
                          Criado em {new Date(rep.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleMarcarPago(rep)}
                        disabled={markingPaidId === rep.id}
                        className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 rounded-xl"
                      >
                        {markingPaidId === rep.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        {markingPaidId === rep.id ? "Marcando..." : "Marcar como pago"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Área de Filtros e Busca */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Abas de Filtros de Status */}
            <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-xl self-start">
              {[
                { id: "todos", label: "Todos" },
                { id: "pendente", label: "Pendentes" },
                { id: "aprovado", label: "Aprovados" },
                { id: "processando", label: "Processando" },
                { id: "pago", label: "Pagos" },
                { id: "falhou", label: "Falharam" },
                { id: "cancelado", label: "Cancelados" },
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
                placeholder="Buscar profissional, chave Pix, CPF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20 text-sm transition"
              />
            </div>
          </div>

          {/* Barra de Bulk Action */}
          {(() => {
            const elegiveis = filteredRepasses.filter(
              (r) => r.status === "pendente" && r.orcamentos?.status !== "pago",
            );
            const elegiveisIds = elegiveis.map((r) => r.id);
            const allSelected =
              elegiveisIds.length > 0 && elegiveisIds.every((id) => selectedIds.has(id));
            const valorSel = elegiveis
              .filter((r) => selectedIds.has(r.id))
              .reduce((acc, r) => acc + Number(r.valor_liquido), 0);
            return (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      disabled={elegiveisIds.length === 0}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) elegiveisIds.forEach((id) => next.add(id));
                        else elegiveisIds.forEach((id) => next.delete(id));
                        setSelectedIds(next);
                      }}
                      className="h-4 w-4 accent-brand"
                    />
                    Selecionar todos pendentes liberados ({elegiveisIds.length})
                  </label>
                  {selectedIds.size > 0 && (
                    <span className="text-slate-500">
                      · {selectedIds.size} selecionado(s) · Total líquido R${" "}
                      {valorSel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
                <Button
                  onClick={handleAprovarSelecionados}
                  disabled={
                    bulkProcessing || selectedIds.size === 0 || !btgStatus?.connected
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
                  title={
                    !btgStatus?.connected
                      ? "Conecte a conta BTG primeiro"
                      : "Disparar PIX em lote via BTG"
                  }
                >
                  {bulkProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Aprovar selecionados ({selectedIds.size})
                </Button>
              </div>
            );
          })()}

          {/* Fila de Repasses / Tabela */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400 font-medium">Buscando dados no Supabase...</p>
            </div>
          ) : filteredRepasses.length === 0 ? (
            <div className="py-20 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                <Inbox className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800">Nenhum repasse encontrado</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Não localizamos nenhum repasse de profissional com os filtros aplicados no
                  momento.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider bg-slate-50/50">
                    <th className="px-3 py-4 w-10"></th>
                    <th className="px-6 py-4">ID / Criação</th>
                    <th className="px-6 py-4">Profissional</th>
                    <th className="px-6 py-4 text-right">Valores</th>
                    <th className="px-6 py-4">Dados Pix Recebedor</th>
                    <th className="px-6 py-4">Status & Alertas</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRepasses.map((rep) => {
                    const prof = profiles[rep.profissional_id];
                    const badge = STATUS_BADGES[rep.status] || {
                      bg: "bg-slate-100",
                      text: "text-slate-700",
                      label: rep.status,
                    };

                    const selectable =
                      rep.status === "pendente" && rep.orcamentos?.status !== "pago";
                    return (
                      <tr key={rep.id} className="hover:bg-slate-50/40 transition group">
                        {/* Checkbox para bulk */}
                        <td className="px-3 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(rep.id)}
                            disabled={!selectable}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(rep.id);
                              else next.delete(rep.id);
                              setSelectedIds(next);
                            }}
                            className="h-4 w-4 accent-brand disabled:opacity-30"
                            title={
                              selectable
                                ? "Selecionar para lote"
                                : "Não elegível (status ou retido)"
                            }
                          />
                        </td>
                        {/* ID e Criação */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-slate-500">
                              #{rep.id.slice(0, 8)}
                            </span>
                            <button
                              onClick={() => handleCopy(rep.id)}
                              className="text-slate-400 hover:text-slate-900 transition"
                              title="Copiar ID completo"
                            >
                              {copiedId === rep.id ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                              )}
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 font-medium">
                            <Calendar className="h-3 w-3" />
                            {new Date(rep.created_at).toLocaleString("pt-BR")}
                          </div>
                        </td>

                        {/* Profissional e Orçamento */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            {prof?.nome || "profissional"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-1 font-medium">
                            Ref: Orcamento #{rep.orcamento_id?.slice(0, 8) || "—"}
                          </div>
                        </td>

                        {/* Valores financeiro */}
                        <td className="px-6 py-4 text-right">
                          <div className="font-black text-sm text-slate-900">
                            R${" "}
                            {Number(rep.valor_liquido).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 font-semibold flex justify-end gap-1.5">
                            <span>Bruto: R$ {Number(rep.valor_bruto).toFixed(2)}</span>
                            <span>·</span>
                            <span className="text-brand">
                              Taxa: R$ {Number(rep.valor_comissao_marketplace).toFixed(2)}
                            </span>
                          </div>
                        </td>

                        {/* Dados Pix */}
                        <td className="px-6 py-4">
                          <div className="text-xs font-bold text-slate-800">
                            {rep.pix_holder_name || (
                              <span className="text-red-500 italic">Nome Ausente</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wide">
                              {rep.pix_key_type || "—"}
                            </span>
                            <span className="font-mono text-slate-600">
                              {maskPixKey(rep.pix_key, rep.pix_key_type)}
                            </span>
                            {rep.pix_holder_document && (
                              <span className="text-slate-400">
                                ({maskDocument(rep.pix_holder_document)})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status e alertas */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.bg}`}
                          >
                            {badge.label}
                          </span>

                          {/* ESCROW TAG */}
                          {rep.status === "pendente" && rep.orcamentos?.status === "pago" && (
                            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertTriangle className="h-3 w-3" />
                              Garantia: Retido
                            </div>
                          )}

                          {rep.erro && (
                            <div className="text-[10px] text-red-600 flex items-start gap-1 mt-1.5 max-w-[200px] leading-tight font-medium">
                              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                              {rep.erro}
                            </div>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {rep.status === "pendente" && (
                              <>
                                <Button
                                  size="sm"
                                  className={`h-8 gap-1 flex items-center ${
                                    rep.orcamentos?.status === "pago"
                                      ? "opacity-50 cursor-not-allowed"
                                      : ""
                                  }`}
                                  onClick={() => {
                                    if (rep.orcamentos?.status === "pago") {
                                      toast.warning(
                                        "Repasse retido. Aguarde o cliente marcar o serviço como concluído.",
                                      );
                                      return;
                                    }
                                    handleAprovar(rep);
                                  }}
                                  disabled={
                                    approvingId === rep.id ||
                                    !btgStatus?.connected ||
                                    rep.orcamentos?.status === "pago"
                                  }
                                  title={
                                    !btgStatus?.connected
                                      ? "Conecte a conta BTG primeiro"
                                      : rep.orcamentos?.status === "pago"
                                        ? "Serviço em andamento (Retido)"
                                        : "Aprovar e transferir"
                                  }
                                >
                                  {approvingId === rep.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : rep.orcamentos?.status === "pago" ? (
                                    <AlertTriangle className="h-4 w-4" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4" />
                                  )}
                                  {approvingId === rep.id
                                    ? "Processando"
                                    : rep.orcamentos?.status === "pago"
                                      ? "Retido"
                                      : "Aprovar (Pix)"}
                                </Button>
                                <button
                                  onClick={() => handleCancelar(rep.id)}
                                  className="h-8 px-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs hover:-translate-y-0.5 transition"
                                  title="Cancelar repasse"
                                >
                                  Cancelar
                                </button>
                              </>
                            )}

                            {rep.status === "falhou" && (
                              <button
                                onClick={() => handleReabrir(rep.id)}
                                className="h-8 px-3 rounded-lg bg-brand text-white hover:bg-brand/90 font-bold text-xs hover:-translate-y-0.5 transition shadow-sm flex items-center gap-1"
                                title="Reabrir repasse falhado como pendente"
                              >
                                <RefreshCw className="h-3.5 w-3.5" /> Reabrir
                              </button>
                            )}

                            {!["pendente", "falhou"].includes(rep.status) && (
                              <span className="text-xs text-slate-400 font-semibold italic">—</span>
                            )}
                          </div>
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
    </div>
  );
}
