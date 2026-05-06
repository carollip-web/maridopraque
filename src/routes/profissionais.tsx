import { createFileRoute } from "@tanstack/react-router";
import { UserRound, Wrench, HeartHandshake, ShieldCheck, Users, Star } from "lucide-react";

export const Route = createFileRoute("/profissionais")({
  component: Profissionais,
});

const professionalDetails = [
  {
    title: "Profissional Mulher",
    icon: UserRound,
    description: "Atendimento feito por uma profissional mulher do início ao fim.",
    longDesc: "Ideal para mulheres que moram sozinhas, idosas ou qualquer pessoa que prefira a presença feminina para serviços de reparos e montagem. Nossas profissionais são treinadas e equipadas com ferramentas de alta performance para garantir um serviço impecável.",
    benefits: [
      "Máxima tranquilidade e identificação",
      "Cuidado e capricho nos detalhes",
      "Ambiente de total segurança e respeito",
      "Especialista em pequenos reparos e montagens"
    ]
  },
  {
    title: "Profissional Homem",
    icon: Wrench,
    description: "Equipe masculina qualificada, verificada e educada.",
    longDesc: "Nossos profissionais homens são selecionados não apenas pela habilidade técnica, mas pelo comportamento exemplar. São especialistas em serviços que exigem maior força física, instalações complexas de TV ou manutenções de engenharia pesada.",
    benefits: [
      "Especialistas em serviços de força e complexidade",
      "Conduta e educação rigorosamente avaliadas",
      "Treinamento técnico para grandes reparos",
      "Equipamentos de proteção e segurança (EPIs)"
    ]
  },
  {
    title: "Homem + Acompanhante Feminina",
    icon: HeartHandshake,
    description: "Segurança em dobro: o técnico pesado com apoio feminino.",
    longDesc: "Nossa modalidade exclusiva e mais escolhida. O técnico realiza o serviço pesado enquanto uma colaboradora mulher acompanha todo o processo, auxiliando na organização, limpeza e garantindo que você se sinta 100% confortável e segura dentro da sua própria casa.",
    benefits: [
      "Você nunca fica sozinha com o técnico",
      "Apoio feminino na organização pós-serviço",
      "Protocolo rígido de conduta e discrição",
      "Paz de espírito total para quem mora sozinha"
    ],
    highlight: true
  }
];

function Profissionais() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-20">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Nossa Equipe</span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Quem entrará na sua casa?
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Acreditamos que a competência técnica deve vir acompanhada de respeito e segurança. Por isso, deixamos você escolher quem te atende.
        </p>
      </div>

      <div className="space-y-24">
        {professionalDetails.map((prof) => (
          <section key={prof.title} className={"relative rounded-[3rem] p-8 md:p-16 border transition " + (prof.highlight ? "border-brand/20 bg-brand-soft/50 shadow-soft" : "border-border bg-card")}>
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <div className={"flex h-16 w-16 items-center justify-center rounded-2xl mb-8 " + (prof.highlight ? "bg-brand text-brand-foreground" : "bg-muted text-foreground")}>
                  <prof.icon className="h-8 w-8" />
                </div>
                {prof.highlight && (
                  <span className="inline-block mb-4 rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-foreground">
                    Modalidade Mais Escolhida
                  </span>
                )}
                <h2 className="text-4xl font-bold tracking-tight">{prof.title}</h2>
                <p className="mt-6 text-lg text-muted-foreground leading-relaxed italic">
                  "{prof.description}"
                </p>
                <p className="mt-6 text-muted-foreground leading-relaxed">
                  {prof.longDesc}
                </p>
              </div>

              <div className="rounded-3xl bg-background/50 p-8 border border-border/50">
                <h3 className="text-lg font-bold mb-6">O que esperar deste atendimento:</h3>
                <ul className="space-y-4">
                  {prof.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                      <span className="font-medium">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-32 grid gap-12 md:grid-cols-2 md:items-center">
        <div className="space-y-8">
          <h2 className="text-4xl font-bold tracking-tight">Nosso Selo de Verificação</h2>
          <p className="text-lg text-muted-foreground">
            A segurança não é opcional. Todo profissional que veste nossa camisa passa por um funil de seleção que exclui 90% dos candidatos.
          </p>
          <div className="grid gap-6">
            {[
              { t: "Identidade Validada", d: "Documentação completa e comprovante de residência verificados." },
              { t: "Sem Antecedentes", d: "Certidões negativas criminais atualizadas periodicamente." },
              { t: "Referência Técnica", d: "Prova de competência e checagem de serviços anteriores." }
            ].map(item => (
              <div key={item.t} className="flex gap-4">
                <div className="h-2 w-2 rounded-full bg-brand mt-2" />
                <div>
                  <h4 className="font-bold">{item.t}</h4>
                  <p className="text-sm text-muted-foreground">{item.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative aspect-square rounded-[3rem] bg-cream flex items-center justify-center p-12 text-center overflow-hidden">
           <Star className="absolute -right-10 -top-10 h-40 w-40 text-brand/10 rotate-12" fill="currentColor" />
           <div className="relative z-10">
              <Star className="h-12 w-12 text-brand mx-auto mb-6" fill="currentColor" />
              <blockquote className="text-2xl font-medium leading-tight">
                "Não é apenas sobre consertar uma torneira, é sobre poder abrir a porta de casa sem medo."
              </blockquote>
              <p className="mt-6 font-bold text-brand uppercase tracking-wider text-sm">Missão Marido pra Quê?</p>
           </div>
        </div>
      </div>
    </div>
  );
}
