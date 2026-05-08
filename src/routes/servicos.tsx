import { createFileRoute, Link } from "@tanstack/react-router";
import { Hammer, Wrench, Scale, ArrowRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Montagem, Reparos e Engenharia | Marido pra Quê?" },
      { name: "description", content: "Catálogo completo: montagem de móveis, reparos elétricos e hidráulicos, pintura, legalização de obras e segurança do trabalho. Preços tabelados." },
      { property: "og:title", content: "Catálogo de Serviços — Marido pra Quê?" },
      { property: "og:description", content: "Tudo o que sua casa precisa, com preço tabelado e profissionais verificados." },
    ],
  }),
  component: Servicos,
});

const categorias = [
  {
    slug: "montagem",
    titulo: "Montagem e Instalação",
    descricao: "Móveis novos ou de mudança, suportes, prateleiras, cortinas — tudo no lugar com nivelamento profissional.",
    icon: Hammer,
    beneficios: [
      "Ferramenta própria e bucha certa pra cada parede",
      "Marcação prévia e nível a laser, sem furo errado",
      "Atendimento no mesmo dia em toda a cidade",
    ],
  },
  {
    slug: "reparos",
    titulo: "Reparos e Manutenção",
    descricao: "Pequenos reparos resolvidos com técnica e segurança — elétrica, hidráulica, pintura e gesso.",
    icon: Wrench,
    beneficios: [
      "Garantia de 30 dias em qualquer reparo",
      "Profissionais com NR-10 para serviços elétricos",
      "Limpeza do ambiente após o serviço",
    ],
  },
  {
    slug: "engenharia",
    titulo: "Engenharia e Legalização",
    descricao: "Aprovação de projetos, alvarás, laudos técnicos e segurança do trabalho com responsável técnico.",
    icon: Scale,
    beneficios: [
      "Engenheiros responsáveis com ART/RRT",
      "Acompanhamento até protocolo e aprovação",
      "Diagnóstico inicial gratuito",
    ],
  },
];

const WHATSAPP = "https://wa.me/5521999999999?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20os%20serviços.";

function Servicos() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-16">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Catálogo Completo</span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Nossos Serviços Especializados.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Escolha uma categoria para ver todos os serviços, com preço tabelado e descrição detalhada.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {categorias.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.slug}
              to="/servicos/$categoria"
              params={{ categoria: c.slug }}
              className="group flex flex-col rounded-3xl border border-border bg-card p-8 transition hover:-translate-y-1 hover:shadow-soft hover:border-brand/40"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-brand">
                <Icon className="h-7 w-7" />
              </div>
              <h2 className="mt-6 text-2xl font-bold tracking-tight">{c.titulo}</h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">{c.descricao}</p>
              <ul className="mt-5 space-y-2">
                {c.beneficios.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-brand flex-shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-brand group-hover:gap-2 transition-all">
                Ver serviços e preços <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-24 rounded-3xl bg-foreground p-12 text-center text-background md:p-16">
        <h2 className="text-3xl font-bold md:text-4xl">Ficou com alguma dúvida?</h2>
        <p className="mx-auto mt-4 max-w-md text-background/70">
          Nossa equipe técnica está pronta para analisar seu caso específico e propor a melhor solução.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-brand px-10 py-4 font-bold text-brand-foreground shadow-brand transition hover:scale-105"
          >
            Chamar no WhatsApp
          </a>
          <Link
            to="/ajuda"
            className="rounded-full border border-background/20 px-10 py-4 font-bold text-background transition hover:bg-background/10"
          >
            Ver Central de Ajuda
          </Link>
        </div>
      </div>
    </div>
  );
}
