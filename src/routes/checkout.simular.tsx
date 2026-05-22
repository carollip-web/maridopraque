import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { simularPagamentoAprovado } from "@/lib/pagamentos.functions";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/checkout/simular")({
  component: CheckoutSimular,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      pagamentoId: (search.pagamentoId as string) || undefined,
    };
  },
});

function CheckoutSimular() {
  const { pagamentoId } = Route.useSearch();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const confirmarPagamento = useServerFn(simularPagamentoAprovado);

  const handleSimulatePayment = async () => {
    if (!pagamentoId) {
      toast.error("ID de pagamento ausente.");
      return;
    }

    if (!session?.access_token) {
      toast.error("Sua sessão expirou.");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await confirmarPagamento({
        data: { pagamentoId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        toast.success("Pagamento aprovado com sucesso!");
        navigate({ to: "/cliente" });
      } else {
        toast.error((res as any).message || "Erro ao aprovar pagamento.");
        setIsProcessing(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Falha na comunicação com o servidor.");
      setIsProcessing(false);
    }
  };

  if (!pagamentoId) {
    return (
      <div className="mx-auto max-w-md px-4 py-32 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
        <h1 className="text-xl font-bold">Página inválida</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Nenhum pagamento selecionado para simulação.
        </p>
        <Button
          onClick={() => navigate({ to: "/cliente" })}
          className="mt-6 rounded-full"
          variant="outline"
        >
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-32 text-center animate-in fade-in zoom-in duration-500">
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-brand-soft text-brand">
        <ShieldCheck className="h-10 w-10" />
      </div>
      <h1 className="text-3xl font-bold">Simulador de Checkout</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Você está em um ambiente de teste. Simule a aprovação do pagamento para continuar o fluxo do
        serviço.
      </p>

      <div className="mt-8 rounded-3xl border border-dashed border-border p-8 bg-card">
        <p className="text-sm font-medium text-foreground">
          Ao clicar abaixo, o sistema marcará este pedido como "Pago" e a reserva da agenda passará
          de temporária para "Confirmada".
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-3">
        <Button
          onClick={handleSimulatePayment}
          disabled={isProcessing}
          size="lg"
          className="rounded-full h-14 text-lg font-bold shadow-lg shadow-brand/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Aprovando...
            </>
          ) : (
            "Aprovar Pagamento (Simulação)"
          )}
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/cliente" })}
          disabled={isProcessing}
          className="rounded-full h-12"
        >
          Cancelar Simulação
        </Button>
      </div>
    </div>
  );
}
