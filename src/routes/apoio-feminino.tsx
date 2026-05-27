import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Heart,
  ShieldCheck,
  TrendingUp,
  Award,
  Users,
  Headphones,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/apoio-feminino")({
  head: () => ({
    meta: [
      { title: "Apoio Feminino — Marido pra Quê?" },
      {
        name: "description",
        content:
          "Profissionais mulheres atendendo clientes que se sentem mais seguras e confortáveis com uma mulher. Cadastre-se e faça parte.",
      },
      { property: "og:title", content: "Apoio Feminino — Marido pra Quê?" },
      {
        property: "og:description",
        content:
          "Segurança, conforto e oportunidade. Conectamos profissionais mulheres a clientes que preferem atendimento feminino.",
      },
    ],
  }),
  component: ApoioFemininoPage,
});

function ApoioFemininoPage() {
  return (
    <div className="bg-background">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-brand/30" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur">
              <Heart className="h-3.5 w-3.5" /> Apoio Feminino
            </span>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Segurança e conforto para quem atende e para quem contrata.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/80 md:text-lg">
              Muitas clientes se sentem mais seguras e confortáveis ao receber
              uma profissional mulher em casa. Se você é uma profissional que
              quer atender esse público, esse programa é pra você.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-brand text-brand-foreground font-bold shadow-brand h-12 px-8"
              >
                <Link to="/profissional-cadastro" search={{ apoio: true }}>
                  Quero me cadastrar <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white h-12 px-8"
              >
                <Link to="/para-profissionais">Saiba mais sobre a plataforma</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-xl">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              Por que participar
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Oportunidade, reconhecimento e acolhimento.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Benefit
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Ambiente de confiança"
              desc="Atenda clientes que se sentem mais seguras recebendo uma profissional mulher em casa. Crie uma relação de confiança desde o primeiro contato."
            />
            <Benefit
              icon={<TrendingUp className="h-5 w-5" />}
              title="Demanda crescente"
              desc="Cada vez mais pessoas buscam profissionais mulheres para reparos e serviços domésticos. Você pode atender esse público em expansão."
            />
            <Benefit
              icon={<Award className="h-5 w-5" />}
              title="Destaque no seu perfil"
              desc="Profissionais do programa recebem o selo Apoio Feminino, visível para clientes que buscam especificamente esse atendimento."
            />
            <Benefit
              icon={<Sparkles className="h-5 w-5" />}
              title="Mesmas condições da plataforma"
              desc="Sem mensalidade, pagamento em até 48h e comissão apenas sobre serviços concluídos. As mesmas vantagens de todos os profissionais."
            />
            <Benefit
              icon={<Users className="h-5 w-5" />}
              title="Comunidade de profissionais"
              desc="Faça parte de uma rede de mulheres que atuam em reparos e serviços. Troque experiências e fortaleça sua carreira."
            />
            <Benefit
              icon={<Headphones className="h-5 w-5" />}
              title="Suporte dedicado"
              desc="Nossa equipe está pronta para ajudar com qualquer dúvida ou situação. Atendimento por WhatsApp sempre que precisar."
            />
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="border-b border-border bg-slate-50/50">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-xl">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              Como funciona
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Comece em 3 passos simples.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Step
              n="1"
              title="Cadastre-se com apoio feminino"
              desc="Crie sua conta de profissional com o selo de Apoio Feminino já ativado. Envie seus documentos e defina suas especialidades."
            />
            <Step
              n="2"
              title="Receba chamados direcionados"
              desc="Clientes que preferem atendimento feminino encontram você com mais facilidade. Receba notificações em tempo real."
            />
            <Step
              n="3"
              title="Trabalhe e receba"
              desc="Conclua o serviço, o cliente aprova e o pagamento cai na sua conta. Simples e seguro, como para todos os profissionais."
            />
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-brand/30 text-white">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <Heart className="h-10 w-10 mx-auto text-brand mb-4" />
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Pronta para fazer a diferença?
          </h2>
          <p className="mt-4 text-white/80 max-w-xl mx-auto">
            Cadastre-se gratuitamente em menos de 5 minutos e comece a atender
            clientes que valorizam seu trabalho e se sentem mais confortáveis
            com uma profissional mulher.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-brand text-brand-foreground font-bold h-12 px-8 shadow-brand"
            >
              <Link to="/profissional-cadastro" search={{ apoio: true }}>
                Quero me cadastrar <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Benefit({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold text-lg">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-brand-foreground font-bold">
        {n}
      </div>
      <h3 className="mt-4 font-semibold text-lg">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
