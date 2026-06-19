import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, Mail, MapPin, Clock, Instagram, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — E-mail | Marido pra Quê?" },
      {
        name: "description",
        content:
          "Fale com a gente por e-mail. Atendimento de segunda a sábado.",
      },
      { property: "og:title", content: "Fale com a Marido pra Quê?" },
      {
        property: "og:description",
        content: "Envie um e-mail para contato@maridopraque.com.",
      },
    ],
  }),
  component: Contato,
});

const CONTATO_EMAIL = "mailto:contato@maridopraque.com?subject=Contato%20via%20site";

function Contato() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-16">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Contato</span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Estamos a um clique de distância.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Escolha o canal de sua preferência. Nossa equipe está pronta para te atender com agilidade
          e educação.
        </p>
      </div>

      <div className="grid gap-12 md:grid-cols-2">
        <div className="space-y-8">
          <div className="rounded-3xl bg-brand p-10 text-brand-foreground shadow-brand transition hover:scale-[1.01]">
            <Mail className="h-10 w-10 mb-6" />
            <h2 className="text-3xl font-bold">E-mail</h2>
            <p className="mt-2 text-brand-foreground/80">
              Envie sua solicitação e receba seu orçamento gratuito por e-mail.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 w-full rounded-full bg-background text-foreground hover:bg-background/90"
            >
              <a href={CONTATO_EMAIL}>
                Mandar mensagem agora
              </a>
            </Button>
            <div className="mt-4 text-center">
              <a href={CONTATO_EMAIL} className="text-sm font-medium hover:underline text-brand-foreground/90">
                contato@maridopraque.com
              </a>
            </div>
            <p className="mt-6 text-[11px] font-medium leading-relaxed text-brand-foreground/70 text-center italic">
              * Prefere atendimento por uma profissional mulher? Sem problema! Vamos verificar a
              disponibilidade na sua região. Caso não haja, você ainda pode contar com a opção de
              apoio feminino durante a visita para sua segurança e conforto.
            </p>
          </div>

          <div className="grid gap-4">
            {/* TODO: Descomentar quando houver número de telefone real
            <div className="rounded-3xl border border-border p-8">
              <Phone className="h-6 w-6 text-brand mb-4" />
              <h3 className="font-bold">Telefone</h3>
              <p className="mt-1 text-sm text-muted-foreground">(21) 99999-9999</p>
            </div>
            */}
          </div>
        </div>

        <div className="space-y-10 py-4">
          <div className="flex gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Localização</h3>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                Atendemos em Copacabana e Ipanema.
              </p>
            </div>
          </div>

          <div className="flex gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Horário de Atendimento</h3>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                Segunda a Sexta: 08h às 19h
                <br />
                Sábado: 08h às 14h
              </p>
              <p className="mt-2 text-sm font-medium text-brand">
                Respondemos em até 4 horas durante o horário comercial.
              </p>
            </div>
          </div>

          <div className="flex gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
              <Instagram className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Redes Sociais</h3>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                Siga-nos para ver fotos de nossos serviços e dicas de manutenção residencial.
              </p>
              <div className="mt-4">
                {/* TODO: Adicionar links reais quando os perfis @maridopraque estiverem ativos no Instagram e Facebook */}
                <p className="text-sm font-medium text-brand">Em breve nas redes sociais. Fique de olho!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-24 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">Perguntas frequentes</h2>
        <div className="space-y-4">
          <details className="group rounded-2xl border border-border bg-card p-6 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-1.5 text-lg font-medium">
              Quanto custa um serviço?
              <span className="shrink-0 transition duration-300 group-open:-rotate-180">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
            </summary>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Cada serviço tem faixa de preço tabelada. Use nosso estimador rápido na página inicial ou consulte o catálogo completo em Serviços.
            </p>
          </details>

          <details className="group rounded-2xl border border-border bg-card p-6 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-1.5 text-lg font-medium">
              Como funciona o apoio feminino?
              <span className="shrink-0 transition duration-300 group-open:-rotate-180">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
            </summary>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Ao solicitar um orçamento, você pode escolher a modalidade com apoio feminino. Uma mulher acompanha todo o atendimento junto com o técnico, para sua segurança e conforto. O serviço tem um acréscimo de 30% sobre o valor base.
            </p>
          </details>

          <details className="group rounded-2xl border border-border bg-card p-6 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-1.5 text-lg font-medium">
              Vocês atendem em quais bairros?
              <span className="shrink-0 transition duration-300 group-open:-rotate-180">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
            </summary>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Atualmente atendemos Copacabana e Ipanema, na Zona Sul do Rio de Janeiro.
            </p>
          </details>

          <details className="group rounded-2xl border border-border bg-card p-6 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-1.5 text-lg font-medium">
              Qual a garantia dos serviços?
              <span className="shrink-0 transition duration-300 group-open:-rotate-180">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
            </summary>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Todos os serviços têm garantia de 30 dias. Se algo não ficou como esperado, o profissional retorna e corrige sem custo adicional.
            </p>
          </details>

          <details className="group rounded-2xl border border-border bg-card p-6 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-1.5 text-lg font-medium">
              Como é feito o pagamento?
              <span className="shrink-0 transition duration-300 group-open:-rotate-180">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
            </summary>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              O pagamento é processado com segurança pelo Mercado Pago. Aceitamos cartão de crédito (até 12x), débito, PIX e boleto. Você só paga após aprovar a proposta do profissional.
            </p>
          </details>
        </div>
      </div>

      <div className="mt-16 rounded-3xl bg-brand p-10 text-center text-brand-foreground shadow-brand">
        <h2 className="text-3xl font-bold">Não encontrou o que procurava?</h2>
        <p className="mt-4 text-brand-foreground/80 max-w-xl mx-auto">
          Confira a nossa lista completa de serviços ou entre em contato diretamente conosco para mais informações.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-8 rounded-full bg-background text-foreground hover:bg-background/90"
        >
          <Link to="/servicos">
            Ver nossos serviços →
          </Link>
        </Button>
      </div>
    </div>
  );
}

