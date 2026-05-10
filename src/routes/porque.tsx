import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, ShieldCheck, Star, CheckCircle2, Heart, Sparkles } from "lucide-react";

export const Route = createFileRoute("/porque")({
  head: () => ({
    meta: [
      { title: "Por que escolher a Marido pra Quê? — Diferenciais" },
      { name: "description", content: "Pontualidade, garantia de 30 dias, profissionais verificados e atendimento com acompanhante feminina. Conheça nossos diferenciais." },
      { property: "og:title", content: "Por que escolher a Marido pra Quê?" },
      { property: "og:description", content: "Reparos com confiança: equipe verificada e garantia de 30 dias." },
    ],
  }),
  component: PorqueNos,
});

function PorqueNos() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-16">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Diferenciais</span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Por que somos a sua melhor escolha.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Não somos apenas prestadores de serviço; somos parceiros no cuidado com o seu lar e com a sua segurança.
        </p>
      </div>

      <div className="grid gap-12 md:grid-cols-2">
        <div className="space-y-10">
          {[
            {
              icon: Clock,
              title: "Pontualidade e Agilidade",
              desc: "Valorizamos o seu tempo. Nossos agendamentos são respeitados à risca e muitos serviços são resolvidos no mesmo dia do orçamento."
            },
            {
              icon: ShieldCheck,
              title: "Segurança Certificada",
              desc: "Fomos pioneiros no modelo de atendimento com acompanhante feminina, pensando especificamente na tranquilidade de quem mora sozinha."
            },
            {
              icon: Star,
              title: "Qualidade Garantida",
              desc: "Oferecemos 30 dias de garantia total em qualquer reparo ou instalação. Se não ficou perfeito, voltamos e corrigimos sem custo."
            }
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
        </div>
        <div className="relative rounded-3xl bg-cream p-12 flex flex-col justify-center overflow-hidden">
          <Sparkles className="absolute -right-8 -top-8 h-32 w-32 text-brand/10" />
          <h2 className="text-3xl font-bold tracking-tight mb-8">Nossos números em 2024</h2>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-4xl font-bold text-brand">+2.500</div>
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Serviços realizados</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-brand">4.9/5</div>
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Avaliação média</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-brand">98%</div>
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Taxa de pontualidade</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-brand">100%</div>
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Segurança garantida</div>
            </div>
          </div>
          <div className="mt-12 flex items-center gap-3 text-brand">
             <Heart className="h-5 w-5 fill-current" />
             <span className="font-semibold">Feito por quem ama resolver.</span>
          </div>
        </div>
      </div>

      <div className="mt-32">
        <h2 className="text-3xl font-bold tracking-tight text-center mb-16">O que dizem nossas clientes</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              name: "Juliana Silva",
              role: "Arquiteta",
              content: "Contratei para a regularização de uma obra complexa no Rio. Foram extremamente profissionais e resolveram toda a burocracia na prefeitura."
            },
            {
              name: "Beatriz Santos",
              role: "Mora sozinha",
              content: "A opção de vir com acompanhante feminina me deu muita paz de espírito. O serviço foi rápido e deixaram tudo limpinho."
            },
            {
              name: "Carla Ferreira",
              role: "Empresária",
              content: "Montaram toda a mobília do meu novo escritório em um único dia. Preço justo e equipe muito educada. Recomendo de olhos fechados."
            }
          ].map((testi, i) => (
            <div key={i} className="rounded-3xl border border-border bg-card p-8 shadow-sm">
              <div className="flex gap-1 text-brand mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="text-muted-foreground leading-relaxed italic mb-6">"{testi.content}"</p>
              <div className="font-bold">{testi.name}</div>
              <div className="text-sm text-muted-foreground">{testi.role}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-32 rounded-[3rem] bg-brand p-12 text-center text-brand-foreground md:p-24">
        <h2 className="text-4xl font-bold md:text-5xl">Pronto para ter sua casa em ordem?</h2>
        <p className="mt-6 text-lg opacity-90 max-w-xl mx-auto">
          Junte-se a mais de 2.500 clientes satisfeitos no Rio de Janeiro. Solicite seu orçamento direto na plataforma.
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
