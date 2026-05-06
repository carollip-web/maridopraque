import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { CreditCard, QrCode, Wallet, CheckCircle2, ShieldCheck, ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/checkout")({
  component: Checkout,
});

function Checkout() {
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock data - in a real app these would come from URL params or state management
  const service = "Montagem de Guarda-Roupa";
  const basePrice = 180;
  const discount = paymentMethod === "pix" ? 0.05 : 0;
  const finalPrice = basePrice * (1 - discount);

  const handlePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setStep(3);
    }, 2000);
  };

  if (step === 3) {
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-bold">Pagamento Confirmado!</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Sua solicitação para <span className="font-semibold text-foreground">{service}</span> foi processada com sucesso.
        </p>
        <div className="mt-10 rounded-2xl bg-muted p-6 text-sm">
          <p>Em instantes, nossa equipe entrará em contato via WhatsApp para confirmar o horário da visita.</p>
        </div>
        <div className="mt-10 flex flex-col gap-3">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/">Voltar para a Home</Link>
          </Button>
          <Button variant="ghost" asChild>
            <a href="https://wa.me/5521999999999">Falar com suporte</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-12 flex items-center justify-between">
        <Link to="/servicos" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para serviços
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Lock className="h-3 w-3" /> Checkout Seguro
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
        {/* Left: Selection */}
        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-6">1. Resumo do Serviço</h2>
            <div className="rounded-3xl border border-border bg-card p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">{service}</h3>
                  <p className="text-sm text-muted-foreground">Profissional Verificado • Marido pra Quê?</p>
                </div>
                <div className="text-xl font-bold">R$ {basePrice.toFixed(2)}</div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-6">2. Forma de Pagamento</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { id: "pix", icon: QrCode, label: "Pix", sub: "5% OFF" },
                { id: "card", icon: CreditCard, label: "Cartão", sub: "Até 10x" },
                { id: "debit", icon: Wallet, label: "Débito", sub: "No local" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`flex flex-col items-center rounded-2xl border p-6 transition ${
                    paymentMethod === m.id 
                    ? "border-brand bg-brand-soft ring-1 ring-brand" 
                    : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <m.icon className={`h-6 w-6 mb-3 ${paymentMethod === m.id ? "text-brand" : "text-muted-foreground"}`} />
                  <span className="font-bold">{m.label}</span>
                  <span className="text-[10px] uppercase font-bold text-brand mt-1">{m.sub}</span>
                </button>
              ))}
            </div>
          </section>

          {paymentMethod === "pix" && (
            <div className="rounded-3xl bg-muted p-8 text-center animate-in fade-in zoom-in duration-300">
               <QrCode className="mx-auto h-32 w-32 mb-4" />
               <p className="text-sm font-medium">Escaneie o QR Code ou copie a chave abaixo:</p>
               <div className="mt-4 flex items-center gap-2 rounded-lg bg-background p-3 text-xs font-mono border border-border">
                  00020126360014BR.GOV.BCB.PIX0114...
                  <Button size="sm" variant="ghost" className="h-7 px-2">Copiar</Button>
               </div>
            </div>
          )}

          {paymentMethod === "card" && (
            <div className="space-y-4 rounded-3xl border border-border p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="grid gap-4">
                <input placeholder="Número do Cartão" className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="MM/AA" className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                  <input placeholder="CVV" className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
                <input placeholder="Nome impresso no cartão" className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
            </div>
          )}
        </div>

        {/* Right: Total & CTA */}
        <div className="h-fit sticky top-24 rounded-[2rem] border border-border bg-card p-8 shadow-soft">
          <h2 className="text-xl font-bold mb-6">Total da Reserva</h2>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>R$ {basePrice.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Desconto Pix (5%)</span>
                <span>- R$ {(basePrice * discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Taxa de serviço</span>
              <span className="text-green-600">Grátis</span>
            </div>
            <div className="pt-4 border-t border-border flex justify-between text-xl font-bold">
              <span>Total</span>
              <span className="text-brand">R$ {finalPrice.toFixed(2)}</span>
            </div>
          </div>

          <Button 
            onClick={handlePayment}
            disabled={!paymentMethod || isProcessing}
            className="mt-8 w-full h-14 rounded-full text-lg font-bold shadow-brand"
          >
            {isProcessing ? "Processando..." : "Confirmar Pagamento"}
          </Button>

          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-brand" />
              Pagamento 100% seguro e criptografado.
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-brand" />
              Garantia de 30 dias em todos os serviços.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
