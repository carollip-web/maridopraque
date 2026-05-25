import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  ArrowLeft,
  Lock,
  Info,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FileText,
  QrCode,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/checkout")({
  component: CheckoutGuard,
  validateSearch: (search: Record<string, unknown>) => ({
    orcamentoId: (search.orcamentoId as string) || undefined,
    service: (search.service as string) || undefined,
    step: Number(search.step) || 1,
  }),
});

function CheckoutGuard() {
  return <Checkout />;
}

type Cobranca = {
  txId: string;
  emv: string;
  qrcode_url: string | null;
  status: string;
  expiresAt: string;
  amount: number;
  cobrancaId: string;
};

type Boleto = {
  id: string;
  paymentUrl: string;
  amount: number;
  dueDate: string;
  status: string;
};

type PaymentMethod = "pix" | "boleto";

function Checkout() {
  const { orcamentoId } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [orcamento, setOrcamento] = useState<any>(null);
  const [loading, setLoading] = useState(!!orcamentoId);
  const [isProcessing, setIsProcessing] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [boleto, setBoleto] = useState<Boleto | null>(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!orcamentoId) { setLoading(false); return; }
    if (authLoading) return;
    if (!user) { setLoading(false); navigate({ to: "/login" }); return; }
    loadOrcamento(orcamentoId);
  }, [orcamentoId, user, authLoading]);

  async function loadOrcamento(id: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("orcamentos")
      .select("id, status, cliente_id, service_name, valor, valor_servico, taxa_material")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      toast.error("Pedido não encontrado.");
      setLoading(false);
      navigate({ to: "/cliente" });
      return;
    }
    if (data.cliente_id !== user?.id) {
      toast.error("Você não tem permissão para acessar este pedido.");
      setLoading(false);
      navigate({ to: "/cliente" });
      return;
    }

    const { data: materiais } = await supabase
      .from("orcamento_materiais")
      .select("id, nome_snapshot, quantidade, preco_unitario")
      .eq("orcamento_id", id);

    setOrcamento({ ...data, orcamento_materiais: materiais || [] });
    setLoading(false);
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  function onPaidConfirmed() {
    if (paid) return;
    setPaid(true);
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    toast.success("Pagamento confirmado!");
    setTimeout(() => {
      window.location.href = "/cliente?tab=pedidos&payment=success";
    }, 1500);
  }

  function startWatchers(cob: Cobranca) {
    // Realtime
    const channel = supabase
      .channel(`btg-cobranca-${cob.cobrancaId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "btg_cobrancas", filter: `id=eq.${cob.cobrancaId}` },
        (payload) => {
          const newStatus = (payload.new as any)?.status;
          if (newStatus === "paga") onPaidConfirmed();
        },
      )
      .subscribe();
    channelRef.current = channel;

    // Polling fallback (a cada 8s)
    pollingRef.current = window.setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("btg-cobranca-status", {
          body: { txId: cob.txId },
        });
        if (!error && data?.status === "paga") onPaidConfirmed();
      } catch (e) {
        console.warn("[checkout] polling error", e);
      }
    }, 8000);
  }

  const handlePreparePayment = async () => {
    if (!orcamentoId) { toast.error("Pedido ausente."); return; }
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("btg-cobranca-criar", {
        body: { orcamentoId },
      });
      if (error || !data?.txId) {
        toast.error(data?.error || error?.message || "Erro ao gerar cobrança Pix.");
        return;
      }
      const cob = data as Cobranca;
      setCobranca(cob);
      startWatchers(cob);
      toast.success("Pix gerado! Escaneie ou copie o código.");
    } catch (err: any) {
      toast.error(err.message || "Falha na comunicação.");
    } finally {
      setIsProcessing(false);
    }
  };

  function startBoletoPolling(bol: Boleto) {
    pollingRef.current = window.setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("btg-boleto-status", {
          body: { boletoId: bol.id },
        });
        if (!error && data?.status === "pago") onPaidConfirmed();
      } catch (e) {
        console.warn("[checkout] boleto polling error", e);
      }
    }, 15000);
  }

  const handleGerarBoleto = async () => {
    if (!orcamentoId) { toast.error("Pedido ausente."); return; }
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("btg-boleto-criar", {
        body: { orcamentoId },
      });
      if (error || !data?.paymentUrl) {
        toast.error(data?.error || error?.message || "Erro ao gerar boleto.");
        return;
      }
      const bol = data as Boleto;
      setBoleto(bol);
      startBoletoPolling(bol);
      window.open(bol.paymentUrl, "_blank", "noopener,noreferrer");
      toast.success("Boleto gerado! Abrimos em uma nova aba.");
    } catch (err: any) {
      toast.error(err.message || "Falha na comunicação.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!cobranca?.emv) return;
    await navigator.clipboard.writeText(cobranca.emv);
    setCopied(true);
    toast.success("Código Pix copiado!");
    setTimeout(() => setCopied(false), 2500);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm text-muted-foreground">Carregando detalhes do pedido...</p>
      </div>
    );
  }

  if (!orcamentoId) {
    return (
      <div className="mx-auto max-w-md px-4 py-32 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
        <h1 className="text-xl font-bold">Inicie pelo seu painel</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Para realizar o pagamento, selecione um pedido aprovado na sua área de cliente.
        </p>
        <Button asChild className="mt-6 rounded-full" variant="outline">
          <Link to="/cliente">Ir para Meus Pedidos</Link>
        </Button>
      </div>
    );
  }

  const valorServico = Number(orcamento?.valor_servico || 0);
  const materiais = orcamento?.orcamento_materiais || [];
  const valorMateriaisCalculado = materiais.reduce(
    (acc: number, m: any) => acc + Number(m.preco_unitario || 0) * Number(m.quantidade || 0),
    0,
  );
  const valorMateriais =
    materiais.length > 0 ? valorMateriaisCalculado : Number(orcamento?.taxa_material || 0);
  const valorTotal = valorServico + valorMateriais;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-12 flex items-center justify-between">
        <Link to="/cliente" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Lock className="h-3 w-3" /> Pagamento Pix • BTG
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Pagamento do Pedido</h2>
            <p className="text-muted-foreground mt-2">
              Pague via Pix de forma instantânea e segura.
            </p>
          </div>

          <div className="rounded-[2.5rem] border border-border bg-card p-8 md:p-10 shadow-sm space-y-8">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                <Info className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Como funciona?</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Gere o Pix abaixo, pague pelo app do seu banco, e a confirmação chega aqui automaticamente.
                </p>
              </div>
            </div>

            <div className="pt-8 border-t border-border">
              <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">
                Resumo do Serviço
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{orcamento.service_name}</span>
                  <span className="text-muted-foreground text-sm">R$ {valorServico.toFixed(2)}</span>
                </div>
                {valorMateriais > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Materiais previstos</span>
                    <span className="text-muted-foreground text-sm">R$ {valorMateriais.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-4 border-t border-border flex justify-between items-center font-bold text-lg">
                  <span>Valor Total</span>
                  <span>R$ {valorTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-3xl p-6 flex justify-between items-center">
              <span className="text-brand font-bold text-lg">Valor a pagar agora (Pix)</span>
              <span className="text-brand font-black text-2xl">R$ {valorServico.toFixed(2)}</span>
            </div>

            {!cobranca && !paid && (
              <Button
                onClick={handlePreparePayment}
                disabled={isProcessing}
                className="w-full h-16 rounded-full text-lg font-bold shadow-lg shadow-brand/20"
              >
                {isProcessing ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando Pix...</>
                ) : "Gerar Pix para pagamento"}
              </Button>
            )}

            {cobranca && !paid && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col items-center gap-4">
                  {cobranca.emv ? (
                    <div className="w-64 h-64 rounded-2xl border border-border bg-white p-3 flex items-center justify-center">
                      <QRCodeSVG
                        value={cobranca.emv}
                        size={232}
                        level="M"
                        marginSize={0}
                      />
                    </div>
                  ) : cobranca.qrcode_url ? (
                    <img
                      src={cobranca.qrcode_url}
                      alt="QR Code Pix"
                      className="w-64 h-64 rounded-2xl border border-border bg-white p-3"
                    />
                  ) : (
                    <div className="w-64 h-64 rounded-2xl border border-border bg-muted flex items-center justify-center text-sm text-muted-foreground">
                      QR indisponível — use o código abaixo
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Escaneie no app do seu banco
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Pix copia e cola
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={cobranca.emv}
                      className="flex-1 min-w-0 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs font-mono"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button onClick={handleCopy} variant="outline" className="rounded-xl shrink-0">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span className="ml-2">{copied ? "Copiado" : "Copiar"}</span>
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aguardando confirmação do pagamento...
                </div>
              </div>
            )}

            {paid && (
              <div className="flex flex-col items-center gap-4 py-8 animate-in fade-in duration-300">
                <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                <h3 className="text-xl font-bold">Pagamento confirmado!</h3>
                <p className="text-sm text-muted-foreground">Redirecionando para seus pedidos...</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-white p-8 shadow-soft space-y-6">
            <h3 className="font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand" /> Garantias Marido Pra Quê
            </h3>
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3 text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-brand mt-2 shrink-0" />
                Pagamento processado via BTG Pactual.
              </li>
              <li className="flex gap-3 text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-brand mt-2 shrink-0" />
                Profissionais verificados e com antecedentes checados.
              </li>
              <li className="flex gap-3 text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-brand mt-2 shrink-0" />
                Suporte dedicado durante todo o serviço.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
