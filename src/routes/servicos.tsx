import { createFileRoute } from "@tanstack/react-router";
import { Hammer, Drill, Lightbulb, ShowerHead, PaintRoller, Wrench, Scale, FileText, HardHat } from "lucide-react";

export const Route = createFileRoute("/servicos")({
  component: Servicos,
});

const services = [
  { icon: Hammer, title: "Montagem de móveis", desc: "Guarda-roupas, estantes, camas e planejados. Montamos móveis novos e usados com ferramentas profissionais." },
  { icon: Drill, title: "Furos e fixação", desc: "Quadros, prateleiras, suportes de TV, cortinas e espelhos. Garantimos a fixação correta em qualquer tipo de parede." },
  { icon: Lightbulb, title: "Elétrica básica", desc: "Instalação de tomadas, lustres, lâmpadas, ventiladores de teto e interruptores com total segurança." },
  { icon: ShowerHead, title: "Hidráulica", desc: "Conserto de vazamentos, instalação de torneiras, chuveiros, sifões, descargas e purificadores de água." },
  { icon: PaintRoller, title: "Pequenas pinturas", desc: "Retoques em paredes, pintura de portas, janelas e reparos rápidos em gesso ou massa corrida." },
  { icon: Wrench, title: "Reparos em geral", desc: "Ajuste de portas, troca de fechaduras, dobradiças, trilhos de gavetas e manutenção de janelas." },
  { icon: Scale, title: "Legalização de projetos", desc: "Assessoria completa para aprovação de projetos arquitetônicos junto aos órgãos competentes." },
  { icon: FileText, title: "Regularização de obras", desc: "Obtenção de Habite-se, alvarás, CND e regularização de imóveis perante a prefeitura e cartório." },
  { icon: HardHat, title: "Segurança do trabalho", desc: "Elaboração de laudos, treinamentos (NRs) e gestão de segurança para sua obra ou empresa." },
];

function Servicos() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-16">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Nossos Serviços</span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Tudo o que sua casa ou obra precisa.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Oferecemos soluções completas, desde pequenos reparos domésticos até a regularização técnica e legal de grandes obras.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {services.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="group rounded-3xl border border-border bg-card p-8 transition hover:shadow-soft hover:bg-cream/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-6 transition group-hover:scale-110">
              <Icon className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-20 rounded-3xl bg-brand-soft p-10 text-center">
        <h2 className="text-2xl font-semibold">Precisa de algo que não está na lista?</h2>
        <p className="mt-2 text-muted-foreground">Mande uma mensagem no WhatsApp e conte o que você precisa. Provavelmente conseguimos resolver!</p>
        <button className="mt-6 rounded-full bg-brand px-8 py-3 font-semibold text-brand-foreground transition hover:opacity-90">
          Solicitar Orçamento Personalizado
        </button>
      </div>
    </div>
  );
}
