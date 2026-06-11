import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Mail, MapPin, Clock, Instagram, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — WhatsApp, telefone e e-mail | Marido pra Quê?" },
      {
        name: "description",
        content:
          "Fale com a gente pelo WhatsApp, telefone ou e-mail. Atendimento ágil de segunda a sábado, com plantão 24h para emergências.",
      },
      { property: "og:title", content: "Fale com a Marido pra Quê?" },
      {
        property: "og:description",
        content: "WhatsApp, telefone e e-mail — escolha o canal que prefere.",
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
            <MessageCircle className="h-10 w-10 mb-6" />
            <h2 className="text-3xl font-bold">WhatsApp</h2>
            <p className="mt-2 text-brand-foreground/80">
              O jeito mais rápido de conseguir seu orçamento gratuito.
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
            <p className="mt-6 text-[11px] font-medium leading-relaxed text-brand-foreground/70 text-center italic">
              * Prefere atendimento por uma profissional mulher? Sem problema! Vamos verificar a
              disponibilidade na sua região. Caso não haja, você ainda pode contar com a opção de
              apoio feminino durante a visita para sua segurança e conforto.
            </p>
          </div>

          <div className="rounded-3xl border border-border p-8">
            <Mail className="h-6 w-6 text-brand mb-4" />
            <h3 className="font-bold">E-mail</h3>
            <p className="mt-1 text-sm text-muted-foreground">contato@maridopraque.com</p>
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
                <br />
                Plantão para emergências 24h via WhatsApp.
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
              <div className="mt-4 flex gap-4">
                <a
                  href="#"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-brand hover:text-brand-foreground"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a
                  href="#"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-brand hover:text-brand-foreground"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
