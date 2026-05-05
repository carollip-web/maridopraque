import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-handyman.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Marido pra Quê? — Montagem de móveis e pequenos reparos" },
      {
        name: "description",
        content:
          "Serviços rápidos e confiáveis de montagem de móveis, elétrica, hidráulica e pequenos reparos para sua casa. Orçamento sem compromisso.",
      },
      { property: "og:title", content: "Marido pra Quê? — Reparos e Montagens" },
      {
        property: "og:description",
        content:
          "Você não precisa de marido — precisa de quem resolve. Montagem de móveis e reparos com agilidade.",
      },
    ],
  }),
  component: Index,
});

const WHATSAPP = "https://wa.me/5511999999999?text=Olá!%20Quero%20um%20orçamento.";

const services = [
  { icon: Hammer, title: "Montagem de móveis", desc: "Guarda-roupas, estantes, camas, escrivaninhas e móveis planejados." },
  { icon: Drill, title: "Furos e fixação", desc: "Quadros, prateleiras, suportes de TV, varões e cortinas." },
  { icon: Lightbulb, title: "Elétrica básica", desc: "Troca de tomadas, lustres, lâmpadas, interruptores e disjuntores." },
  { icon: ShowerHead, title: "Hidráulica", desc: "Vazamentos, torneiras, sifões, válvulas e descargas." },
  { icon: PaintRoller, title: "Pequenas pinturas", desc: "Retoques, paredes, portas e reparos em gesso." },
  { icon: Wrench, title: "Reparos em geral", desc: "Fechaduras, dobradiças, gavetas, portas e janelas." },
];

const reasons = [
  { icon: Clock, title: "Atendimento no mesmo dia", desc: "Agendamento rápido e pontualidade garantida." },
  { icon: ShieldCheck, title: "Profissional de confiança", desc: "Equipe verificada, educada e com ferramentas próprias." },
  { icon: Star, title: "Serviço com garantia", desc: "30 dias de garantia em todo serviço executado." },
];

const testimonials = [
  { name: "Camila R.", text: "Montaram meu guarda-roupa em 2 horas. Super organizados!", role: "Vila Mariana" },
  { name: "Rafael M.", text: "Resolveu o vazamento que ninguém conseguia. Salvou meu domingo.", role: "Pinheiros" },
  { name: "Júlia A.", text: "Atendimento educado, preço justo. Virou meu contato fixo.", role: "Moema" },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <a href="#" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand shadow-brand">
              <Wrench className="h-5 w-5 text-brand-foreground" />
            </span>
            <span className="text-lg font-bold tracking-tight">
              Marido pra Quê<span className="text-brand">?</span>
            </span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="#servicos" className="text-muted-foreground transition hover:text-foreground">Serviços</a>
            <a href="#porque" className="text-muted-foreground transition hover:text-foreground">Por que nós</a>
            <a href="#depoimentos" className="text-muted-foreground transition hover:text-foreground">Depoimentos</a>
            <a href="#contato" className="text-muted-foreground transition hover:text-foreground">Contato</a>
          </nav>
          <Button asChild className="rounded-full bg-brand text-brand-foreground shadow-brand hover:bg-brand/90">
            <a href={WHATSAPP} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-1.5 h-4 w-4" /> Orçamento
            </a>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-warm" />
        <div className="absolute -right-40 -top-40 -z-10 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-4 py-1.5 text-xs font-semibold text-brand">
              <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
              Atendendo hoje em toda a cidade
            </span>
            <h1 className="mt-5 text-balance text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Você não precisa de marido. <span className="bg-gradient-brand bg-clip-text text-transparent">Precisa de quem resolve.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Montagem de móveis, pequenos reparos, elétrica e hidráulica feitos com agilidade,
              capricho e garantia. Sem dor de cabeça.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full bg-gradient-brand text-brand-foreground shadow-brand hover:opacity-95">
                <a href={WHATSAPP} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-5 w-5" /> Pedir orçamento grátis
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-foreground/15 bg-background/60">
                <a href="#servicos">Ver serviços</a>
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand" /> Sem taxa de visita</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand" /> Garantia de 30 dias</div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-brand opacity-20 blur-2xl" />
            <img
              src={heroImage}
              alt="Profissional sorrindo enquanto monta móveis em uma sala iluminada"
              width={1536}
              height={1024}
              className="rounded-[1.75rem] shadow-soft ring-1 ring-border/60"
            />
            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border md:block">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft">
                  <Star className="h-5 w-5 fill-brand text-brand" />
                </div>
                <div>
                  <div className="text-sm font-semibold">4.9 / 5.0</div>
                  <div className="text-xs text-muted-foreground">+1.200 serviços realizados</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Serviços */}
      <section id="servicos" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand">Serviços</span>
          <h2 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">Tudo o que sua casa pediu</h2>
          <p className="mt-4 text-muted-foreground">
            Da montagem do guarda-roupa ao vazamento da pia. Resolvemos rápido e do jeito certo.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:shadow-soft"
            >
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-soft opacity-0 transition group-hover:opacity-100" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand text-brand-foreground shadow-brand">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="relative mt-5 text-lg font-bold">{title}</h3>
              <p className="relative mt-2 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Por que nós */}
      <section id="porque" className="border-y border-border bg-cream/60">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-10 md:grid-cols-3">
            {reasons.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section id="depoimentos" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand">Depoimentos</span>
          <h2 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">Quem chama, recomenda</h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="rounded-2xl border border-border bg-card p-6 shadow-soft/50">
              <div className="flex gap-0.5 text-brand">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 text-foreground">"{t.text}"</blockquote>
              <figcaption className="mt-5 text-sm">
                <div className="font-semibold">{t.name}</div>
                <div className="text-muted-foreground">{t.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="contato" className="px-4 pb-20">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-brand p-10 text-brand-foreground shadow-brand md:p-14">
          <div className="grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Combinou pelo WhatsApp, resolvido no mesmo dia.
              </h2>
              <p className="mt-3 text-brand-foreground/85">
                Mande uma foto ou descreva o serviço. Te respondemos em minutos com orçamento.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild size="lg" className="rounded-full bg-background text-foreground hover:bg-background/90">
                <a href={WHATSAPP} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-5 w-5" /> Falar no WhatsApp
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-brand-foreground/30 bg-transparent text-brand-foreground hover:bg-brand-foreground/10 hover:text-brand-foreground">
                <a href="tel:+5511999999999">
                  <Phone className="mr-2 h-5 w-5" /> (11) 99999-9999
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-cream/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand">
              <Wrench className="h-4 w-4 text-brand-foreground" />
            </span>
            <span className="font-semibold text-foreground">Marido pra Quê?</span>
          </div>
          <p>© {new Date().getFullYear()} — Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a
        href={WHATSAPP}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar no WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-brand-foreground shadow-brand transition hover:scale-105"
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    </div>
  );
}
