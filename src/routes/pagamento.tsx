import { createFileRoute } from "@tanstack/react-router";
import { QrCode, CreditCard, Wallet, ShieldCheck, Zap } from "lucide-react";
import { PaymentSimulator } from "@/components/PaymentSimulator";

export const Route = createFileRoute("/pagamento")({
  component: Pagamento,
});

function Pagamento() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-16 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Pagamento</span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Pagamento facilitado e seguro.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Escolha a forma que melhor se adapta ao seu bolso. Aceitamos as principais modalidades do mercado com transparência total.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-8 text-center transition hover:shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-6">
            <QrCode className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold">Pix</h3>
          <p className="mt-3 text-sm text-muted-foreground">Pagamento instantâneo com 5% de desconto no valor total do serviço.</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-8 text-center transition hover:shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-6">
            <CreditCard className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold">Cartão de Crédito</h3>
          <p className="mt-3 text-sm text-muted-foreground">Parcele em até 10x sem juros. Aceitamos Visa, Master, Elo e Amex.</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-8 text-center transition hover:shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-6">
            <Wallet className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold">Débito</h3>
          <p className="mt-3 text-sm text-muted-foreground">Pagamento presencial através de maquininha moderna no local do serviço.</p>
        </div>
      </div>

      <div className="mt-20 flex flex-col items-center justify-center rounded-3xl bg-foreground p-12 text-background md:p-20">
        <Zap className="h-10 w-10 text-brand mb-6" fill="currentColor" />
        <h2 className="text-3xl font-bold text-center">Quer simular ou pagar agora?</h2>
        <p className="mt-4 text-center text-background/70 max-w-md">
          Você pode usar nosso simulador para conferir o valor do seu serviço e realizar o pagamento de forma antecipada.
        </p>
        <div className="mt-10">
          <PaymentSimulator />
        </div>
      </div>

      <div className="mt-20 flex flex-wrap justify-center gap-12 text-muted-foreground opacity-60">
        <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Ambiente Seguro</div>
        <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Dados Criptografados</div>
        <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Proteção Anti-Fraude</div>
      </div>
    </div>
  );
}
