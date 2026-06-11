import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import {
  ShieldCheck,
  ArrowLeft,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PagamentoSplitResumo } from "@/components/PagamentoSplitResumo";

type OrcamentoRow = Pick<
  Tables<"orcamentos">,
  | "id"
  | "status"
  | "cliente_id"
  | "service_name"
  | "valor"
  | "valor_servico"
  | "taxa_material"
  | "tipo_atendimento"
>;
type OrcamentoMaterialRow = Pick<
  Tables<"orcamento_materiais">,
  "id" | "nome_snapshot" | "quantidade" | "preco_unitario"
>;
type OrcamentoCheckout = OrcamentoRow & {
  orcamento_materiais: OrcamentoMaterialRow[];
};

// SDK do Mercado Pago é carregado externamente — tipagem mínima.
type MercadoPagoBrickController = { unmount?: () => void } | null;
type MercadoPagoSDK = new (
  publicKey: string,
  options?: { locale?: string },
) => {
  bricks: () => {
    create: (
      kind: string,
      containerId: string,
      settings: Record<string, unknown>,
    ) => Promise<MercadoPagoBrickController>;
  };
};
declare global {
  interface Window {
    MercadoPago?: MercadoPagoSDK;
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

const checkoutSearchSchema = z.object({
  orcamentoId: z.string().optional(),
  service: z.string().optional(),
  step: z.coerce.number().int().min(1).optional().catch(1).default(1),
});

export const Route = createFileRoute("/checkout")({
  component: CheckoutGuard,
  validateSearch: checkoutSearchSchema,
});

function CheckoutGuard() {
  return <Checkout />;
}

async function getFunctionErrorMessage(error: unknown, fallback: string) {
  const err = error as { context?: unknown; message?: string } | null;
  const context = err?.context;
  try {
    if (context instanceof Response) {
      const payload = (await context.clone().json()) as
        | { message?: string; error?: string }
        | null;
      return payload?.message || payload?.error || fallback;
    }
  } catch {
    // Mantém fallback abaixo.
  }
  return err?.message || fallback;
}

function Checkout() {
  const { orcamentoId } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [orcamento, setOrcamento] = useState<OrcamentoCheckout | null>(null);
  const [loading, setLoading] = useState(!!orcamentoId);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paid, setPaid] = useState(false);
  const [brickConfig, setBrickConfig] = useState<{
    publicKey: string;
    amount: number;
    payerEmail: string;
  } | null>(null);
  const [brickError, setBrickError] = useState<string | null>(null);
  const brickControllerRef = useRef<MercadoPagoBrickController>(null);
  const brickMountedRef = useRef(false);

  useEffect(() => {
    if (!orcamentoId) { setLoading(false); return; }
    if (authLoading) return;
    if (!user) { setLoading(false); navigate({ to: "/login" }); return; }
    loadOrcamento(orcamentoId);
  }, [orcamentoId, user, authLoading]);

  async function loadOrcamento(id: string) {
    setLoading(true);
    if (!user?.id) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("orcamentos")
      .select("id, status, cliente_id, service_name, valor, valor_servico, taxa_material, tipo_atendimento")
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

  function onPaidConfirmed() {
    if (paid) return;
    setPaid(true);
    toast.success("Pagamento confirmado!");
    setTimeout(() => {
      window.location.href = "/cliente?tab=pedidos&payment=success";
    }, 1500);
  }

  // ===== Checkout Transparente (Payment Brick) =====
  // 1) Carrega config (publicKey, valor) via edge function
  useEffect(() => {
    if (!orcamento || !orcamentoId || paid) return;
    if (orcamento.status !== "aprovado") return;
    if (brickConfig) return;

    let cancelled = false;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const { data, error } = await supabase.functions.invoke("mercadopago-cartao-init", {
          body: { orcamentoId },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (error || !data?.publicKey) {
          const msg = error
            ? await getFunctionErrorMessage(error, "Não foi possível iniciar o checkout.")
            : data?.message || "Não foi possível iniciar o checkout.";
          setBrickError(msg);
          return;
        }
        setBrickConfig({
          publicKey: data.publicKey,
          amount: Number(data.amount),
          payerEmail: data.payerEmail || user?.email || "",
        });
      } catch (e) {
        if (!cancelled) setBrickError((e as Error)?.message || "Falha ao iniciar checkout.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orcamento, orcamentoId, paid, brickConfig, user?.email]);

  // 2) Carrega o SDK e monta o Brick
  useEffect(() => {
    if (!brickConfig || brickMountedRef.current) return;

    let cancelled = false;

    async function ensureSdk(): Promise<any> {
      if ((window as any).MercadoPago) return (window as any).MercadoPago;
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[data-mp-sdk="v2"]');
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Falha ao carregar SDK MP")));
          return;
        }
        const s = document.createElement("script");
        s.src = "https://sdk.mercadopago.com/js/v2";
        s.async = true;
        s.dataset.mpSdk = "v2";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Falha ao carregar SDK MP"));
        document.head.appendChild(s);
      });
      return (window as any).MercadoPago;
    }

    (async () => {
      try {
        const MP = await ensureSdk();
        if (cancelled) return;
        const mp = new MP(brickConfig.publicKey, { locale: "pt-BR" });
        const bricksBuilder = mp.bricks();
        brickMountedRef.current = true;
        brickControllerRef.current = await bricksBuilder.create(
          "payment",
          "payment-brick-container",
          {
            initialization: {
              amount: brickConfig.amount,
              payer: { email: brickConfig.payerEmail },
            },
            customization: {
              paymentMethods: {
                creditCard: "all",
                debitCard: "all",
                maxInstallments: 12,
              },
              visual: { style: { theme: "default" } },
            },
            callbacks: {
              onReady: () => console.info("[brick] ready"),
              onError: (err: any) => {
                console.error("[brick] error", err);
                toast.error(err?.message || "Erro no formulário de pagamento.");
              },
              onSubmit: async ({ formData }: any) => {
                try {
                  setIsProcessing(true);
                  const { data: sessionData } = await supabase.auth.getSession();
                  const token = sessionData.session?.access_token;
                  if (!token) {
                    toast.error("Sua sessão expirou. Faça login novamente.");
                    return;
                  }
                  const { data, error } = await supabase.functions.invoke(
                    "mercadopago-cartao-processar",
                    {
                      body: { orcamentoId, formData },
                      headers: { Authorization: `Bearer ${token}` },
                    },
                  );
                  if (error || !data?.ok) {
                    const msg = error
                      ? await getFunctionErrorMessage(error, "Pagamento recusado.")
                      : data?.message || "Pagamento recusado.";
                    toast.error(msg);
                    return;
                  }
                  if (data.status === "approved") {
                    onPaidConfirmed();
                  } else if (data.status === "in_process" || data.status === "pending") {
                    toast.message("Pagamento em análise. Você será notificado em instantes.");
                    setTimeout(() => {
                      window.location.href = "/cliente?tab=pedidos&payment=pending";
                    }, 2000);
                  } else {
                    toast.error(`Pagamento ${data.status}: ${data.statusDetail || ""}`);
                  }
                } catch (e: any) {
                  console.error("[brick] submit error", e);
                  toast.error(e?.message || "Falha ao processar pagamento.");
                } finally {
                  setIsProcessing(false);
                }
              },
            },
          },
        );
      } catch (e: any) {
        if (!cancelled) {
          console.error("[brick] init error", e);
          setBrickError(e?.message || "Falha ao iniciar o formulário.");
          brickMountedRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        brickControllerRef.current?.unmount?.();
      } catch {
        // noop
      }
      brickControllerRef.current = null;
      brickMountedRef.current = false;
    };
  }, [brickConfig, orcamentoId]);

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
            {!paid && (
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

            {!paid && (
              <div className="space-y-3">
                {brickError && (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{brickError}</span>
                  </div>
                )}
                {!brickConfig && !brickError && (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Preparando formulário seguro...
                  </div>
                )}
                <div id="payment-brick-container" />
                {isProcessing && (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Processando pagamento...
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Lock className="h-3 w-3" /> Pagamento processado de forma segura pelo Mercado Pago. Seus dados não são armazenados em nosso servidor.
                </p>
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
          {orcamento?.id && (
            <PagamentoSplitResumo orcamentoId={orcamento.id} />
          )}
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
                Valor fica retido na plataforma até a conclusão do serviço.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
