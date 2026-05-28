import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import {
  ShieldCheck,
  ArrowLeft,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FileText,
  QrCode,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

// BTG desativado temporariamente — não homologado em produção, aguardando split MP
// import { QRCodeSVG } from "qrcode.react";


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

type PaymentMethod = "pix" | "boleto" | "cartao";

async function getFunctionErrorMessage(error: any, fallback: string) {
  const context = error?.context;
  try {
    if (context instanceof Response) {
      const payload = await context.clone().json();
      return payload?.message || payload?.error || fallback;
    }
  } catch {
    // Mantém fallback abaixo.
  }
  return error?.message || fallback;
}

function Checkout() {
  const { orcamentoId } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [orcamento, setOrcamento] = useState<any>(null);
  const [loading, setLoading] = useState(!!orcamentoId);
  const [isProcessing, setIsProcessing] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cartao");
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [boleto, setBoleto] = useState<Boleto | null>(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
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
    if (!user?.id) { setLoading(false); return; }
    const [{ data, error }, { data: profile }] = await Promise.all([
      supabase
      .from("orcamentos")
      .select("id, status, cliente_id, service_name, valor, valor_servico, taxa_material, tipo_atendimento")
      .eq("id", id)
        .maybeSingle(),
      supabase.from("profiles").select("whatsapp").eq("id", user.id).maybeSingle(),
    ]);

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
    if (profile?.whatsapp) setWhatsapp(profile.whatsapp);
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
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.auth.refreshSession();
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      const token = freshSession?.access_token;
      if (!token) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        return;
      }

      console.info("[checkout] chamando btg-cobranca-criar", {
        orcamentoId,
        status: orcamento?.status,
        valor_servico: orcamento?.valor_servico,
        userId: user?.id,
      });

      const { data, error } = await supabase.functions.invoke("btg-cobranca-criar", {
        body: { orcamentoId },
        headers: { Authorization: `Bearer ${token}` },
      });

      console.info("[checkout] btg-cobranca-criar result", { data, error });

      if (error || !data?.txId) {
        const message = error
          ? await getFunctionErrorMessage(error, "Erro ao gerar cobrança Pix.")
          : data?.message || data?.error || "Erro ao gerar cobrança Pix.";
        toast.error(message);
        return;
      }
      const cob = data as Cobranca;
      setCobranca(cob);
      startWatchers(cob);
      toast.success("Pix gerado! Escaneie ou copie o código.");
    } catch (err: any) {
      console.error("[checkout] erro Pix BTG", err);
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
    if (isProcessing) return;
    if (!orcamentoId) { toast.error("Pedido inválido para pagamento."); return; }
    if (!orcamento) { toast.error("Pedido ainda não carregado."); return; }
    if (orcamento.status !== "aprovado") {
      toast.error("Este pedido ainda não está liberado para pagamento.");
      return;
    }
    const whatsappDigits = whatsapp.replace(/\D/g, "");
    if (![10, 11, 12, 13].includes(whatsappDigits.length)) {
      toast.error("Informe um WhatsApp válido para receber o boleto.");
      return;
    }
    setIsProcessing(true);
    try {
      if (!user?.id) { toast.error("Faça login novamente para continuar."); return; }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        return;
      }
      await supabase.from("profiles").update({ whatsapp }).eq("id", user.id);
      console.info("[checkout] chamando btg-boleto-criar", {
        orcamentoId,
        status: orcamento?.status,
        valor_servico: orcamento?.valor_servico,
        userId: user.id,
      });
      const { data, error } = await supabase.functions.invoke("btg-boleto-criar", {
        body: { orcamentoId, whatsapp },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.info("[checkout] btg-boleto-criar result", { data, error });
      if (error || !data?.paymentUrl) {
        if (error) {
          console.error("[checkout] erro btg-boleto-criar", {
            message: error.message,
            name: error.name,
            context: error.context,
          });
        }
        toast.error(data?.message || data?.error || await getFunctionErrorMessage(error, "Não foi possível iniciar o pagamento."));
        return;
      }
      const bol = data as Boleto;
      const url = bol.paymentUrl || "";
      const isInvalidUrl =
        !url.startsWith("http") || url.includes("link-exemplo") || url.includes("example");
      if (isInvalidUrl) {
        console.warn("[checkout] BTG retornou link inválido/placeholder", data);
        toast.error("Boleto criado, mas o BTG retornou um link inválido (ambiente sandbox). Verifique a configuração BTG.");
        return;
      }
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

  const handlePagarCartao = async () => {
    if (isProcessing) return;
    if (!orcamentoId) {
      toast.error("Pedido inválido.");
      return;
    }
    if (!orcamento) {
      toast.error("Pedido ainda não carregado.");
      return;
    }
    if (orcamento.status !== "aprovado") {
      toast.error("Este pedido ainda não está liberado para pagamento.");
      return;
    }

    setIsProcessing(true);

    try {
      if (!user?.id) {
        toast.error("Faça login novamente para continuar.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        return;
      }

      console.info("[checkout] chamando mercadopago-cartao-criar", {
        orcamentoId,
        status: orcamento.status,
        valor_servico: orcamento.valor_servico,
        userId: user.id,
      });

      const { data, error } = await supabase.functions.invoke("mercadopago-cartao-criar", {
        body: { orcamentoId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.info("[checkout] mercadopago-cartao-criar result", { data, error });

      if (error || !data?.checkoutUrl) {
        if (error) {
          console.error("[checkout] erro mercadopago-cartao-criar", {
            message: error.message,
            name: error.name,
            context: error.context,
          });
        }

        const message = error
          ? await getFunctionErrorMessage(error, "Não foi possível iniciar o pagamento com cartão.")
          : data?.message || data?.error || "Mercado Pago não retornou link de checkout.";

        toast.error(message);
        return;
      }

      toast.success("Redirecionando para o Mercado Pago...");
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      console.error("[checkout] erro cartão Mercado Pago", err);
      toast.error(err?.message || "Falha ao iniciar pagamento com cartão.");
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

  if (!orcamento) {
    return (
      <div className="mx-auto max-w-md px-4 py-32 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
        <h1 className="text-xl font-bold">Pedido não encontrado</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Não foi possível carregar os dados deste pedido.
        </p>
        <Button asChild className="mt-6 rounded-full" variant="outline">
          <Link to="/cliente">Voltar para Meus Pedidos</Link>
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
    
  const requiresApoioFeminino = orcamento?.tipo_atendimento === "homem_com_apoio_feminino";
  const taxaApoioFeminino = requiresApoioFeminino ? valorServico * 0.3 : 0;
  
  const valorTotal = valorServico + valorMateriais + taxaApoioFeminino;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-12 flex items-center justify-between">
        <Link to="/cliente" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Lock className="h-3 w-3" /> Pagamento seguro
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Pagamento do Pedido</h2>
            <p className="text-muted-foreground mt-2">
              Pagamento seguro via cartão de crédito ou débito pelo Mercado Pago.
            </p>
          </div>

          <div className="rounded-[2.5rem] border border-border bg-card p-8 md:p-10 shadow-sm space-y-8">
            {!cobranca && !boleto && !paid && (
              <div className="flex gap-3">
                <div className="rounded-2xl border border-brand bg-brand-soft/40 p-4 text-left flex-1">
                  <CreditCard className="h-5 w-5 text-brand mb-2" />
                  <div className="font-bold text-sm">Cartão</div>
                  <div className="text-xs text-muted-foreground">Crédito ou débito via Mercado Pago</div>
                </div>
              </div>
            )}

            <div className="pt-8 border-t border-border">
              <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">
                Resumo do Serviço
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{orcamento.service_name || "Serviço"}</span>
                  <span className="text-muted-foreground text-sm">{formatCurrency(valorServico)}</span>
                </div>
                {valorMateriais > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Materiais previstos</span>
                    <span className="text-muted-foreground text-sm">{formatCurrency(valorMateriais)}</span>
                  </div>
                )}
                {requiresApoioFeminino && (
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Taxa Apoio Feminino (30%)</span>
                    <span className="text-muted-foreground text-sm">{formatCurrency(taxaApoioFeminino)}</span>
                  </div>
                )}
                <Separator />
                <div className="pt-4 border-t border-border flex justify-between items-center font-bold text-lg">
                  <span>Valor Total</span>
                  <span>{formatCurrency(valorTotal)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-3xl p-6 flex justify-between items-center">
              <span className="text-brand font-bold text-lg">
                Valor a pagar agora (Cartão)
              </span>
              <span className="text-brand font-black text-2xl">{formatCurrency(valorTotal)}</span>
            </div>

            {!cobranca && !boleto && !paid && method === "cartao" && (
              <div className="space-y-3">
                <Button
                  onClick={handlePagarCartao}
                  disabled={isProcessing}
                  className="w-full h-16 rounded-full text-lg font-bold shadow-lg shadow-brand/20"
                >
                  {isProcessing ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Redirecionando...</>
                  ) : (
                    <><CreditCard className="mr-2 h-5 w-5" /> Pagar com Cartão</>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Você será redirecionado para o ambiente seguro do Mercado Pago para concluir o pagamento.
                </p>
              </div>
            )}

            {boleto && !paid && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="rounded-2xl border border-border bg-muted/30 p-6 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-bold">R$ {boleto.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Vencimento</span>
                    <span className="font-bold">
                      {new Date(boleto.dueDate + "T00:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>

                <Button asChild className="w-full h-14 rounded-full text-base font-bold">
                  <a href={boleto.paymentUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Abrir boleto BTG
                  </a>
                </Button>

                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  O boleto bancário leva até 2 dias úteis para compensar após o pagamento.
                  O profissional só será notificado da confirmação após a compensação.
                </p>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aguardando compensação do boleto...
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
                Pagamento processado via Mercado Pago.
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
