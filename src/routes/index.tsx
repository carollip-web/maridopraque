import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Hammer,
  Wrench,
  Drill,
  Lightbulb,
  ShowerHead,
  PaintRoller,
  Phone,
  MessageCircle,
  Clock,
  ShieldCheck,
  Star,
  CheckCircle2,
  ArrowRight,
  HeartHandshake,
  UserRound,
  Users,
  CreditCard,
  QrCode,
  Wallet,
  Scale,
  FileText,
  HardHat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-tools.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Marido pra Quê? — Reparos, Obras e Regularização" },
      {
        name: "description",
        content:
          "Serviços rápidos de montagem, reparos, legalização de projetos, regularização de obras e segurança do trabalho. Você escolhe o profissional — inclusive opção com acompanhamento feminino.",
      },
      { property: "og:title", content: "Marido pra Quê? — Reparos e Montagens" },
      {
        property: "og:description",
        content:
          "Você não precisa de marido — precisa de quem resolve. Escolha entre profissional mulher, homem ou homem com acompanhante.",
      },
    ],
  }),
  component: Index,
});



const services = [
  { categoryId: "montagem", icon: Hammer, title: "Montagem de móveis", desc: "Guarda-roupas, estantes, camas e planejados." },
  { categoryId: "montagem", icon: Drill, title: "Furos e fixação", desc: "Quadros, prateleiras, suportes de TV e cortinas." },
  { categoryId: "reparos", icon: Lightbulb, title: "Elétrica básica", desc: "Tomadas, lustres, lâmpadas e interruptores." },
  { categoryId: "reparos", icon: ShowerHead, title: "Hidráulica", desc: "Vazamentos, torneiras, sifões e descargas." },
  { categoryId: "reparos", icon: PaintRoller, title: "Pequenas pinturas", desc: "Retoques, paredes e reparos em gesso." },
  { categoryId: "reparos", icon: Wrench, title: "Reparos em geral", desc: "Fechaduras, dobradiças, gavetas e janelas." },
  { categoryId: "engenharia", icon: Scale, title: "Legalização de projetos", desc: "Assessoria completa para aprovação de projetos arquitetônicos." },
  { categoryId: "engenharia", icon: FileText, title: "Regularização de obras", desc: "Habite-se, alvarás e regularização junto à prefeitura." },
  { categoryId: "engenharia", icon: HardHat, title: "Segurança do trabalho", desc: "Laudos, treinamentos e gestão de segurança especializada." },
];

const professionals = [
  {
    id: "mulher",
    icon: UserRound,
    label: "Profissional mulher",
    desc: "Atendimento feito por uma profissional mulher do início ao fim.",
  },
  {
    id: "homem",
    icon: Wrench,
    label: "Profissional homem",
    desc: "Equipe masculina, qualificada e verificada para qualquer serviço.",
  },
  {
    id: "acompanhante",
    icon: HeartHandshake,
    label: "Homem + acompanhante feminina",
    desc: "Pensado para quem mora sozinha: o profissional vem com uma acompanhante mulher.",
    highlight: true,
  },
];

const reasons = [
  { icon: Clock, title: "Atendimento ágil", desc: "Agendamento no mesmo dia, com pontualidade." },
  { icon: ShieldCheck, title: "Equipe verificada", desc: "Documentos checados, conduta avaliada e referências reais." },
  { icon: Star, title: "Garantia de 30 dias", desc: "Se algo não ficou bom, voltamos sem custo." },
];

const paymentMethods = [
  { icon: QrCode, title: "Pix", desc: "Aprovação instantânea e 5% de desconto no valor total." },
  { icon: CreditCard, title: "Cartão de Crédito", desc: "Aceitamos todas as bandeiras em até 10x sem juros." },
  { icon: Wallet, title: "Cartão de Débito", desc: "Pagamento presencial rápido através de maquininha." },
];

const testimonials = [
  { name: "Camila R.", text: "Pedi atendimento com acompanhante feminina e me senti super segura.", role: "Vila Mariana" },
  { name: "Rafael M.", text: "Resolveu o vazamento que ninguém conseguia. Salvou meu domingo.", role: "Pinheiros" },
  { name: "Júlia A.", text: "Profissional pontual, educada e caprichosa. Virou meu contato fixo.", role: "Moema" },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 md:grid-cols-[1.1fr_1fr] md:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Atendendo hoje em toda a cidade
            </span>
            <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-[4rem]">
              Você não precisa de marido. <span className="text-brand">Precisa de quem resolve.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              De pequenos reparos à regularização de obras com agilidade e capricho.
              Você escolhe o profissional — inclusive a opção com acompanhante feminina.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild variant="brand" size="xl">
                <Link to="/orcamentos">
                  Pedir orçamento agora <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/servicos">Ver serviços</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand" /> Sem taxa de visita</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand" /> Garantia de 30 dias</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand" /> Pagamento facilitado</div>
            </div>
          </div>
          <div className="relative">
            <img
              src={heroImage}
              alt="Ferramentas dispostas sobre fundo bege claro"
              width={1536}
              height={1280}
              className="aspect-[4/5] w-full rounded-3xl object-cover ring-1 ring-border"
            />
          </div>
        </div>
      </section>

      {/* Por que nós (Diferenciais no topo) */}
      <section id="porque" className="border-y border-border bg-brand-soft/30 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Nossos Diferenciais</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">O que nos torna únicos.</h2>
          </div>
          <div className="grid gap-10 md:grid-cols-3">
            {reasons.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-8 transition hover:shadow-soft">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-brand-foreground mb-6">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Profissionais — escolha */}
      <section id="profissionais" className="bg-cream/60">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <div className="grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-end">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Você escolhe</span>
              <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                Atendimento do jeito que faz sentido pra você.
              </h2>
            </div>
            <p className="text-muted-foreground md:text-lg">
              Sabemos que receber alguém em casa exige confiança. Por isso oferecemos três
              opções de atendimento — incluindo acompanhante feminina para clientes que moram
              sozinhas e preferem mais segurança.
            </p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {professionals.map(({ id, icon: Icon, label, desc, highlight }) => (
              <div
                key={label}
                className={
                  "relative flex flex-col rounded-2xl border p-7 transition hover:-translate-y-0.5 " +
                  (highlight
                    ? "border-brand/30 bg-brand-soft"
                    : "border-border bg-card")
                }
              >
                {highlight && (
                  <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-foreground">
                    Diferencial
                  </span>
                )}
                <div className={
                  "flex h-11 w-11 items-center justify-center rounded-xl " +
                  (highlight ? "bg-brand text-brand-foreground" : "bg-muted text-foreground")
                }>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                <Link
                  to="/profissionais"
                  hash={id}
                  className="mt-6 inline-flex items-center text-sm font-medium text-foreground transition hover:text-brand"
                >
                  Saiba mais <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <p>
                <span className="font-medium text-foreground">Política de segurança.</span> Todos os
                profissionais e acompanhantes passam por verificação de documentos, antecedentes
                e avaliação contínua dos clientes.
              </p>
            </div>
            <div className="flex items-start gap-3 text-sm text-muted-foreground border-t border-border pt-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <p>
                <span className="font-medium text-foreground">Disponibilidade.</span> Prefere atendimento por uma profissional mulher? Sem problema! Vamos verificar a disponibilidade na sua região. Caso não haja, você ainda pode contar com a opção de uma acompanhante para sua segurança e conforto.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Serviços */}
      <section id="servicos" className="mx-auto max-w-6xl px-4 py-24">
        <div className="grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Serviços</span>
            <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Tudo o que sua casa pediu.
            </h2>
          </div>
          <p className="text-muted-foreground md:text-lg">
            Da montagem do guarda-roupa ao vazamento da pia. Resolvemos rápido e do jeito certo,
            com ferramentas próprias e zero bagunça.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {services.map(({ categoryId, icon: Icon, title, desc }) => (
            <Link
              key={title}
              to="/servicos/$categoria"
              params={{ categoria: categoryId }}
              className="group bg-background p-7 transition hover:bg-cream"
            >
              <Icon className="h-6 w-6 text-brand" strokeWidth={1.5} />
              <h3 className="mt-5 text-base font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              <div className="mt-4 flex items-center text-xs font-semibold text-brand opacity-0 transition group-hover:opacity-100">
                Ver detalhes →
              </div>
            </Link>
          ))}
        </div>
        
        <div className="mt-12 flex justify-center">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/servicos">Ver todos os serviços <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="mx-auto max-w-6xl px-4 py-24 border-t border-border">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Depoimentos</span>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Quem chama, recomenda.</h2>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="rounded-2xl border border-border bg-card p-7">
              <div className="flex gap-0.5 text-brand">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 text-foreground leading-relaxed">"{t.text}"</blockquote>
              <figcaption className="mt-6 text-sm">
                <div className="font-medium">{t.name}</div>
                <div className="text-muted-foreground">{t.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Métodos de Pagamento */}
      <section id="pagamento" className="mx-auto max-w-6xl px-4 py-24 border-t border-border">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Pagamento</span>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">Formas de pagamento seguras.</h2>
          <p className="mt-4 text-muted-foreground md:text-lg">O pagamento é feito apenas após a realização do serviço.</p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {paymentMethods.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center text-center p-8 rounded-2xl border border-border bg-card transition hover:shadow-soft">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand mb-6">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
