import { createFileRoute } from "@tanstack/react-router";
import { QrCode, CreditCard, Wallet, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/pagamento")({
  component: Pagamento,
});

function Pagamento() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-16 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          Pagamento
        </span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Pagamento facilitado e seguro.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Escolha a forma que melhor se adapta ao seu bolso. Aceitamos as principais modalidades do
          mercado com transparência total.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-8 text-center transition hover:shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-6">
            <QrCode className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold">Pix</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Pagamento instantâneo com 5% de desconto no valor total do serviço.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-8 text-center transition hover:shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-6">
            <CreditCard className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold">Cartão de Crédito</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Parcele em até 10x sem juros. Aceitamos Visa, Master, Elo e Amex.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-8 text-center transition hover:shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-6">
            <Wallet className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold">Débito</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Pagamento presencial através de maquininha moderna no local do serviço.
          </p>
        </div>
      </div>

      <div className="mt-20 rounded-3xl bg-brand p-12 text-center text-brand-foreground md:p-20">
        <ShieldCheck className="h-12 w-12 mx-auto mb-6" />
        <h2 className="text-3xl font-bold md:text-4xl">Segurança total no pagamento.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
          Você só paga quando o serviço estiver concluído e aprovado por você. Aceitamos Pix com
          desconto ou cartão com parcelamento, tudo direto com o profissional no local.
        </p>
        <div className="mt-10 flex justify-center">
          <a
            href="https://wa.me/5521999999999?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20pagamentos."
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-background px-10 py-4 font-bold text-foreground transition hover:scale-105 shadow-xl"
          >
            Tirar dúvidas no WhatsApp
          </a>
        </div>
      </div>

      <div className="mt-20 flex flex-wrap justify-center gap-12 text-muted-foreground opacity-60">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Ambiente Seguro
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Dados Criptografados
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Proteção Anti-Fraude
        </div>
      </div>
    </div>
  );
}
