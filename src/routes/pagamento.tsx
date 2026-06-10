import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, ShieldCheck, QrCode, FileText } from "lucide-react";

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

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
        <div className="rounded-3xl border border-border bg-card p-8 text-center transition hover:shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-6">
            <CreditCard className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold">Cartão de Crédito ou Débito</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Pague com cartão em até 12x. Processado com segurança pelo Mercado Pago.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-8 text-center transition hover:shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-6">
            <QrCode className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold">PIX</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Pagamento instantâneo via PIX. Aprovação imediata, sem taxas extras.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-8 text-center transition hover:shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-6">
            <FileText className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold">Boleto Bancário</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Gere o boleto e pague em qualquer banco. Compensação em até 3 dias úteis.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-8 text-center transition hover:shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-6">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold">Pagamento Seguro</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Você só é cobrado após aceitar a proposta do profissional. Sem surpresas.
          </p>
        </div>
      </div>

      <div className="mt-20 rounded-3xl bg-brand p-12 text-center text-brand-foreground md:p-20">
        <ShieldCheck className="h-12 w-12 mx-auto mb-6" />
        <h2 className="text-3xl font-bold md:text-4xl">Segurança total no pagamento.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
          Você só paga quando aceitar a proposta do profissional. O pagamento é processado via Mercado Pago com proteção antifraude. Em caso de problema, nosso suporte está disponível.
        </p>
        <div className="mt-10 flex justify-center">
          <a
            href="mailto:contato@maridopraque.com?subject=Dúvida%20sobre%20pagamentos"
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
