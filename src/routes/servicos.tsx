import { createFileRoute } from "@tanstack/react-router";
import { Hammer, Drill, Lightbulb, ShowerHead, PaintRoller, Wrench, Scale, FileText, HardHat } from "lucide-react";

export const Route = createFileRoute("/servicos")({
  component: Servicos,
});

const serviceCategories = [
  {
    title: "Montagem e Instalação",
    icon: Hammer,
    description: "Serviços especializados em colocar sua casa em ordem com precisão e segurança.",
    items: [
      {
        name: "Montagem de Móveis",
        details: "Montamos móveis novos de todas as lojas e marcas, além de desmontagem e remontagem para mudanças. Temos expertise em móveis planejados, guarda-roupas, camas e cozinhas moduladas."
      },
      {
        name: "Furos e Fixação",
        details: "Instalação de suportes de TV com fiação embutida, quadros, prateleiras, cortinas, persianas e acessórios de banheiro. Utilizamos os materiais adequados para cada tipo de parede (alvenaria, drywall ou madeira)."
      }
    ]
  },
  {
    title: "Reparos e Manutenção",
    icon: Wrench,
    description: "Soluções rápidas para os problemas do dia a dia que exigem técnica e ferramentas certas.",
    items: [
      {
        name: "Elétrica Básica",
        details: "Troca de resistências de chuveiro, instalação de luminárias, pendentes, ventiladores de teto, troca de tomadas e interruptores seguindo as normas de segurança."
      },
      {
        name: "Hidráulica",
        details: "Reparo de vazamentos em torneiras, válvulas de descarga, caixas acopladas e sifões. Instalação de purificadores de água, máquinas de lavar e aquecedores."
      },
      {
        name: "Pintura e Acabamento",
        details: "Retoques rápidos em paredes, pintura de portas e janelas, reparos em gesso, aplicação de massa corrida em pequenos buracos e acabamentos finos."
      }
    ]
  },
  {
    title: "Engenharia e Legalização",
    icon: Scale,
    description: "Suporte técnico e burocrático para garantir que sua obra ou projeto esteja 100% legalizado.",
    items: [
      {
        name: "Legalização de Projetos",
        details: "Aprovação de projetos arquitetônicos na prefeitura, regularização de plantas, desmembramento e unificação de lotes. Gestão completa do processo burocrático."
      },
      {
        name: "Regularização de Obras",
        details: "Obtenção de Alvará de Construção, Habite-se, CND do INSS e averbação de construção em matrícula de imóvel. Deixamos sua documentação em dia."
      },
      {
        name: "Segurança do Trabalho",
        details: "Elaboração de PGR, PCMAT, laudos de periculosidade e insalubridade. Treinamentos de NRs para equipes e gestão de segurança em canteiros de obra."
      }
    ]
  }
];

function Servicos() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-20">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Catálogo Completo</span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Nossos Serviços Especializados.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Desde o pequeno parafuso até a documentação da sua obra, cuidamos de tudo com o mesmo nível de excelência e profissionalismo.
        </p>
      </div>

      <div className="space-y-32">
        {serviceCategories.map((category) => (
          <section key={category.title} className="relative">
            <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
              <div className="sticky top-24 self-start">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-brand-foreground shadow-brand mb-6">
                  <category.icon className="h-8 w-8" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight">{category.title}</h2>
                <p className="mt-4 text-muted-foreground leading-relaxed">
                  {category.description}
                </p>
              </div>

              <div className="grid gap-6">
                {category.items.map((item) => (
                  <div key={item.name} className="group rounded-3xl border border-border bg-card p-8 transition hover:bg-cream/20">
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                      {item.name}
                    </h3>
                    <p className="mt-4 text-muted-foreground leading-relaxed">
                      {item.details}
                    </p>
                    <div className="mt-6 flex items-center text-sm font-semibold text-brand opacity-0 transition group-hover:opacity-100">
                      Pedir orçamento para este serviço →
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-32 rounded-3xl bg-foreground p-12 text-center text-background md:p-20">
        <h2 className="text-3xl font-bold md:text-4xl">Ficou com alguma dúvida?</h2>
        <p className="mx-auto mt-4 max-w-md text-background/70">
          Nossa equipe técnica está pronta para analisar seu caso específico e propor a melhor solução.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <button className="rounded-full bg-brand px-10 py-4 font-bold text-brand-foreground shadow-brand transition hover:scale-105">
            Chamar no WhatsApp
          </button>
          <button className="rounded-full border border-background/20 px-10 py-4 font-bold text-background transition hover:bg-background/10">
            Ver Central de Ajuda
          </button>
        </div>
      </div>
    </div>
  );
}
