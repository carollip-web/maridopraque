import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, ShieldCheck, Star, Heart, Sparkles } from "lucide-react";

export const Route = createFileRoute("/porque")({
  head: () => ({
    meta: [
      { title: "Por que escolher a Marido pra Quê? — Diferenciais" },
      {
        name: "description",
        content:
          "Pontualidade, garantia de 30 dias, profissionais verificados e atendimento com apoio feminino durante a visita. Conheça nossos diferenciais.",
      },
      { property: "og:title", content: "Por que escolher a Marido pra Quê?" },
      {
        property: "og:description",
        content: "Reparos com confiança: equipe verificada e garantia de 30 dias.",
      },
    ],
  }),
  component: PorqueNos,
});

function PorqueNos() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-16">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          Diferenciais
        </span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Por que somos a sua melhor escolha.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Não somos apenas prestadores de serviço; somos parceiros no cuidado com o seu lar e com a
          sua segurança.
        </p>
      </div>

      <div className="grid gap-12 md:grid-cols-2">
        <div className="space-y-10">
          {[
            {
              icon: Clock,
              title: "Pontualidade e Agilidade",
              desc: "Valorizamos o seu tempo. Nossos agendamentos são respeitados à risca e muitos serviços são resolvidos no mesmo dia do orçamento.",
            },
            {
              icon: ShieldCheck,
              title: "Segurança Certificada",
              desc: "Fomos pioneiros no modelo de atendimento com apoio feminino durante a visita, pensando especificamente na tranquilidade de quem mora sozinha.",
            },
            {
              icon: Star,
              title: "Qualidade Garantida",
              desc: "Oferecemos 30 dias de garantia total em qualquer reparo ou instalação. Se não ficou perfeito, voltamos e corrigimos sem custo.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{title}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
          <div className="pt-4 flex justify-center md:justify-start">
            <Link
              to="/servicos"
              className="rounded-full bg-brand px-8 py-3 font-bold text-brand-foreground transition hover:scale-105"
            >
              Ver nossos serviços →
            </Link>
          </div>
        </div>
        <div className="relative rounded-3xl bg-cream p-12 flex flex-col justify-center overflow-hidden">
          <Sparkles className="absolute -right-8 -top-8 h-32 w-32 text-brand/10" />
          <h2 className="text-3xl font-bold tracking-tight mb-8">O que oferecemos</h2>
          {/* TODO: Substituir por métricas reais do banco quando houver volume (query em orcamentos + avaliacoes) */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-4xl font-bold text-brand">7</div>
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">
                Categorias de serviço
              </div>
            </div>
            <div>
              <div className="text-xl font-bold text-brand md:text-2xl mt-1">Copacabana<br />e Ipanema</div>
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">
                Área de atuação
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-brand">30</div>
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">
                Dias de garantia
              </div>
            </div>
            <div>
              <div className="text-xl font-bold text-brand md:text-2xl mt-1">Seguro</div>
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">
                Pagamento via Mercado Pago
              </div>
            </div>
          </div>
          <div className="mt-12 flex items-center gap-3 text-brand">
            <Heart className="h-5 w-5 fill-current" />
            <span className="font-semibold">Feito por quem ama resolver.</span>
          </div>
        </div>
      </div>

      <div className="mt-32 rounded-[3rem] border-2 border-brand bg-cream p-12 text-center shadow-sm md:p-20">
        <h2 className="text-3xl font-bold text-brand md:text-4xl">Segurança que só a Marido pra Quê? oferece</h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-brand/80">
          Somos a única plataforma de serviços domésticos com a opção de apoio feminino durante a visita. Uma mulher acompanha todo o atendimento para que você se sinta 100% segura dentro da sua casa.
        </p>
        <div className="mt-10 flex justify-center">
          <Link
            to="/profissionais"
            className="rounded-full bg-brand px-8 py-4 font-bold text-brand-foreground shadow-brand transition hover:scale-105"
          >
            Saiba mais sobre o apoio feminino →
          </Link>
        </div>
      </div>

      {/* TODO: Restaurar seção de depoimentos quando houver avaliações reais de clientes */}

      <div className="mt-32 rounded-[3rem] bg-brand p-12 text-center text-brand-foreground md:p-24">
        <h2 className="text-4xl font-bold md:text-5xl">Sua casa merece esse cuidado.</h2>
        <p className="mt-6 text-lg opacity-90 max-w-xl mx-auto">
          Atendendo Copacabana e Ipanema com agilidade e profissionais verificados. Solicite seu orçamento
          direto na plataforma.
        </p>
        <div className="mt-10 flex justify-center">
          <Link
            to="/servicos"
            className="rounded-full bg-background px-10 py-4 font-bold text-foreground transition hover:scale-105 shadow-xl"
          >
            Solicitar orçamento
          </Link>
        </div>
      </div>
    </div>
  );
}
