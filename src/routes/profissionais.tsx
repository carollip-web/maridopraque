import { createFileRoute } from "@tanstack/react-router";
import { UserRound, Wrench, HeartHandshake, ShieldCheck, Users, Star } from "lucide-react";

export const Route = createFileRoute("/profissionais")({
  component: Profissionais,
});

const professionals = [
  {
    icon: UserRound,
    label: "Profissional mulher",
    desc: "Atendimento feito por uma profissional mulher do início ao fim. Ideal para quem busca máxima tranquilidade e identificação.",
  },
  {
    icon: Wrench,
    label: "Profissional homem",
    desc: "Equipe masculina qualificada, verificada e treinada para lidar com serviços pesados e técnicos com total educação.",
  },
  {
    icon: HeartHandshake,
    label: "Homem + acompanhante feminina",
    desc: "Pensado para quem mora sozinha: o profissional vem acompanhado de uma colaboradora mulher para garantir sua segurança e conforto.",
    highlight: true,
  },
];

function Profissionais() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-16">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Quem Atende</span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Segurança e confiança em primeiro lugar.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Escolher quem entra na sua casa é uma decisão importante. Por isso, oferecemos opções que se adaptam à sua necessidade de segurança.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {professionals.map(({ icon: Icon, label, desc, highlight }) => (
          <div
            key={label}
            className={
              "relative flex flex-col rounded-3xl border p-8 transition hover:-translate-y-1 " +
              (highlight
                ? "border-brand/30 bg-brand-soft ring-1 ring-brand/10 shadow-soft"
                : "border-border bg-card shadow-sm")
            }
          >
            {highlight && (
              <span className="absolute -top-3 left-8 rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-foreground shadow-sm">
                Mais Escolhido
              </span>
            )}
            <div className={
              "flex h-14 w-14 items-center justify-center rounded-2xl " +
              (highlight ? "bg-brand text-brand-foreground" : "bg-muted text-foreground")
            }>
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-xl font-bold">{label}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-24 grid gap-12 md:grid-cols-2">
        <div className="space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">Nossa política de verificação</h2>
          <p className="text-muted-foreground">
            Todos os nossos profissionais passam por um rigoroso processo antes de serem enviados à sua residência:
          </p>
          <ul className="space-y-4">
            {[
              "Checagem de antecedentes criminais em âmbito estadual e federal.",
              "Verificação de documentos e comprovante de residência.",
              "Entrevista técnica e avaliação de competências comportamentais.",
              "Avaliação contínua através do feedback de cada cliente atendido."
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl bg-cream/50 p-8 border border-border/50">
          <Star className="h-8 w-8 text-brand mb-4" fill="currentColor" />
          <blockquote className="text-lg font-medium leading-relaxed italic">
            "A ideia do profissional homem vir com uma acompanhante mulher mudou minha percepção sobre contratar reparos. Me senti respeitada e segura o tempo todo."
          </blockquote>
          <cite className="mt-4 block not-italic font-semibold text-muted-foreground">— Maria Fernanda, Cliente desde 2023</cite>
        </div>
      </div>
    </div>
  );
}
