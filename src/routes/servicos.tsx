import { createFileRoute } from "@tanstack/react-router";
import { Hammer, Drill, Lightbulb, ShowerHead, PaintRoller, Wrench, Scale, FileText, HardHat } from "lucide-react";

export const Route = createFileRoute("/servicos")({
  component: Servicos,
});

const serviceCategories = [
  {
    id: "montagem",
    title: "Montagem e Instalação",
    icon: Hammer,
    description: "Serviços especializados em colocar sua casa em ordem com precisão e segurança.",
    items: [
      {
        name: "Montagem de Móveis",
        details: "Montamos móveis novos de todas as lojas e marcas, além de desmontagem e remontagem para mudanças.",
        pricing: [
          { label: "Cama solteiro / casal", value: "R$ 120" },
          { label: "Guarda-roupa (por porta)", value: "R$ 60" },
          { label: "Painel de TV / Estante", value: "A partir de R$ 150" },
          { label: "Cozinha completa (mão de obra)", value: "Sob consulta" }
        ]
      },
      {
        name: "Furos e Fixação",
        details: "Instalação de suportes, quadros, prateleiras e acessórios em qualquer tipo de parede.",
        pricing: [
          { label: "Kit fixação (até 5 furos)", value: "R$ 80" },
          { label: "Suporte de TV articulado", value: "R$ 130" },
          { label: "Varal de teto ou parede", value: "R$ 100" },
          { label: "Cortinas e persianas (par)", value: "R$ 90" }
        ]
      }
    ]
  },
  {
    id: "reparos",
    title: "Reparos e Manutenção",
    icon: Wrench,
    description: "Soluções rápidas para os problemas do dia a dia que exigem técnica e ferramentas certas.",
    items: [
      {
        name: "Elétrica Básica",
        details: "Troca de resistências, luminárias, tomadas e interruptores seguindo as normas de segurança.",
        pricing: [
          { label: "Troca de resistência chuveiro", value: "R$ 80" },
          { label: "Instalação de ventilador teto", value: "R$ 150" },
          { label: "Troca de tomada/interruptor", value: "R$ 40/un" },
          { label: "Instalação de lustre/pendente", value: "A partir de R$ 90" }
        ]
      },
      {
        name: "Hidráulica",
        details: "Reparo de vazamentos em torneiras, válvulas de descarga, caixas acopladas e sifões.",
        pricing: [
          { label: "Conserto de vazamento torneira", value: "R$ 70" },
          { label: "Reparo de descarga (mão de obra)", value: "R$ 110" },
          { label: "Troca de reparo de chuveiro", value: "R$ 90" },
          { label: "Instalação de purificador", value: "R$ 80" }
        ]
      },
      {
        name: "Pintura e Acabamento",
        details: "Retoques rápidos em paredes, pintura de portas e janelas, reparos em gesso e massa corrida.",
        pricing: [
          { label: "Pintura de porta (mão de obra)", value: "R$ 150" },
          { label: "Reparo gesso (furo até 10cm)", value: "R$ 80" },
          { label: "Massa corrida + lixamento (m²)", value: "R$ 45" },
          { label: "Pintura teto banheiro (anti-mofo)", value: "R$ 120" }
        ]
      }
    ]
  },
  {
    id: "engenharia",
    title: "Engenharia e Legalização",
    icon: Scale,
    description: "Suporte técnico e burocrático para garantir que sua obra ou projeto esteja 100% legalizado.",
    items: [
      {
        name: "Legalização de Projetos",
        details: "Aprovação de projetos arquitetônicos na prefeitura e regularização de plantas.",
        pricing: [
          { label: "Consulta técnica inicial", value: "R$ 250" },
          { label: "Levantamento métrico (m²)", value: "A partir de R$ 15" },
          { label: "Entrada em processo prefeitura", value: "R$ 850" },
          { label: "Retificações de área", value: "Sob consulta" }
        ]
      },
      {
        name: "Regularização de Obras",
        details: "Obtenção de Alvará de Construção, Habite-se, CND do INSS e averbação em matrícula.",
        pricing: [
          { label: "Emissão de Habite-se", value: "Sob consulta" },
          { label: "Alvará de reforma", value: "A partir de R$ 600" },
          { label: "Certidão Negativa (CND)", value: "R$ 400" },
          { label: "Averbação de construção", value: "Sob consulta" }
        ]
      },
      {
        name: "Segurança do Trabalho",
        details: "Elaboração de PGR, PCMAT, laudos de periculosidade e treinamentos de NRs.",
        pricing: [
          { label: "Laudo técnico (unidade)", value: "A partir de R$ 450" },
          { label: "Treinamento NR-35 (por pessoa)", value: "R$ 180" },
          { label: "Plano de Gerenciamento (PGR)", value: "Sob consulta" },
          { label: "Vistoria de segurança", value: "R$ 350" }
        ]
      }
    ]
  }
];

const WHATSAPP = "https://wa.me/5521999999999?text=Olá!%20Quero%20um%20orçamento.";

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
          <section id={category.id} key={category.title} className="relative scroll-mt-32">
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
                  <div key={item.name} className="group rounded-3xl border border-border bg-card p-8 transition hover:shadow-soft">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                        {item.name}
                      </h3>
                    </div>
                    <p className="mt-4 text-muted-foreground leading-relaxed">
                      {item.details}
                    </p>

                    {/* Tabela de Preços */}
                    {item.pricing && (
                      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-background/50">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                              <th className="px-4 py-2.5 font-semibold">Serviço / Item</th>
                              <th className="px-4 py-2.5 font-semibold text-right">Valor Mão de Obra</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {item.pricing.map((price) => (
                              <tr key={price.label} className="transition hover:bg-muted/30">
                                <td className="px-4 py-2.5 text-muted-foreground">{price.label}</td>
                                <td className="px-4 py-2.5 text-right font-bold text-foreground">{price.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="mt-6 flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        * Materiais não inclusos • Preços base
                      </p>
                      <a 
                        href={`${WHATSAPP}%20Serviço:%20${encodeURIComponent(item.name)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center text-sm font-semibold text-brand hover:underline"
                      >
                        Solicitar Orçamento →
                      </a>
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
          <a 
            href={WHATSAPP}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-brand px-10 py-4 font-bold text-brand-foreground shadow-brand transition hover:scale-105"
          >
            Chamar no WhatsApp
          </a>
          <button className="rounded-full border border-background/20 px-10 py-4 font-bold text-background transition hover:bg-background/10">
            Ver Central de Ajuda
          </button>
        </div>
      </div>
    </div>
  );
}
