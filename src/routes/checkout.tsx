import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  ShieldCheck,
  ArrowLeft,
  Lock,
  Info,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { iniciarPagamentoOrcamento } from "@/lib/pagamentos.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout")({
  component: CheckoutGuard,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      orcamentoId: (search.orcamentoId as string) || undefined,
      // Fallback para legado ou novos fluxos sem ID inicial
      service: (search.service as string) || undefined,
      step: Number(search.step) || 1,
    };
  },
});

function CheckoutGuard() {
  return <Checkout />;
}

function Checkout() {
  const { orcamentoId, service: queryService, step } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [orcamento, setOrcamento] = useState<any>(null);
  const [loading, setLoading] = useState(!!orcamentoId);
  const [isProcessing, setIsProcessing] = useState(false);

  const startPayment = useServerFn(iniciarPagamentoOrcamento);

  useEffect(() => {
    if (orcamentoId) {
      loadOrcamento(orcamentoId);
    }
  }, [orcamentoId]);

  async function loadOrcamento(id: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("orcamentos")
      .select(`
        id, 
        status, 
        cliente_id, 
        service_name, 
        valor, 
        valor_servico
      `)
      .eq("id", id)
      .single();

    console.info("[Checkout.loadOrcamento] Resultado:", { data, error, id });

    if (error || !data) {
      toast.error("Pedido não encontrado.");
      navigate({ to: "/cliente" });
      return;
    }
    setOrcamento(data);
    setLoading(false);
  }

  const handlePreparePayment = async () => {
    if (!orcamentoId) {
      toast.error("Identificador do pedido ausente.");
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await startPayment({ 
        data: { orcamentoId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (res.ok && res.checkoutUrl) {
        toast.success("Redirecionando para pagamento seguro...");
        window.location.href = res.checkoutUrl;
      } else {
        toast.error((res as any).message || "Erro ao preparar pagamento.");
      }
    } catch (err: any) {
      toast.error(err.message || "Falha na comunicação com o servidor.");
    } finally {
      setIsProcessing(false);
    }
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
  const valorMateriais = (orcamento?.orcamento_materiais || []).reduce(
    (acc: number, m: any) => acc + Number(m.preco_unitario || 0) * Number(m.quantidade || 0),
    0
  );
  const valorTotal = valorServico + valorMateriais;
  const upfrontAmount = valorTotal * 0.5;
  const remainingAmount = valorTotal - upfrontAmount;



  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-12 flex items-center justify-between">
        <Link
          to="/cliente"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Lock className="h-3 w-3" /> Checkout Seguro em implantação
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Pagamento do Pedido</h2>
            <p className="text-muted-foreground mt-2">
              Confira os detalhes e prepare seu pagamento de forma segura.
            </p>
          </div>

          <div className="rounded-[2.5rem] border border-border bg-card p-8 md:p-10 shadow-sm space-y-8">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                <Info className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Como funciona o pagamento?</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Para sua segurança, processamos o pagamento do sinal (50%) através de nossa plataforma. 
                  O valor restante é pago diretamente ao profissional após a conclusão.
                </p>
              </div>
            </div>

            <div className="pt-8 border-t border-border">
              <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">
                Resumo do Serviço
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-foreground font-medium">{orcamento.service_name}</span>
                  <span className="text-muted-foreground text-sm">R$ {valorServico.toFixed(2)}</span>
                </div>
                {valorMateriais > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-medium">Materiais previstos</span>
                    <span className="text-muted-foreground text-sm">R$ {valorMateriais.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-4 border-t border-border flex justify-between items-center font-bold text-lg">
                  <span>Valor Total</span>
                  <span>R$ {valorTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-brand font-bold text-lg">Sinal a pagar (50%)</span>
                <span className="text-brand font-black text-2xl">R$ {upfrontAmount.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                Saldo de R$ {remainingAmount.toFixed(2)} após o serviço
              </p>
            </div>

            <Button
              onClick={handlePreparePayment}
              disabled={isProcessing}
              className="w-full h-16 rounded-full text-lg font-bold shadow-lg shadow-brand/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...
                </>
              ) : (
                "Preparar Pagamento"
              )}
            </Button>
            
            <p className="text-center text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
              Ambiente Seguro · Sem cobrança imediata
            </p>
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
                Seu dinheiro fica protegido até a conclusão do serviço.
              </li>
              <li className="flex gap-3 text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-brand mt-2 shrink-0" />
                Profissionais verificados e com antecedentes criminais checados.
              </li>
              <li className="flex gap-3 text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-brand mt-2 shrink-0" />
                Suporte dedicado para qualquer eventualidade durante o reparo.
              </li>
            </ul>
          </div>

          <div className="rounded-3xl bg-brand p-8 text-white">
            <h3 className="font-bold mb-2">Dúvidas sobre o sinal?</h3>
            <p className="text-sm text-white/80 leading-relaxed mb-4">
              O sinal de 50% é uma segurança para o profissional reservar a data e para você garantir a prioridade no atendimento.
            </p>
            <Link to="/ajuda" className="text-xs font-bold underline uppercase tracking-widest">
              Saiba mais sobre pagamentos
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
