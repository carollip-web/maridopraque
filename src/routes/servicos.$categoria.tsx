import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Hammer, Wrench, Scale, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

type CategoryMeta = {
  slug: string;
  nome: string;
  titulo: string;
  subtitulo: string;
  description: string;
  icon: typeof Hammer;
  beneficios: string[];
};

const categorias: Record<string, CategoryMeta> = {
  montagem: {
    slug: "montagem",
    nome: "montagem",
    titulo: "Montagem de móveis e instalações",
    subtitulo: "Guarda-roupa, estante, painel de TV, cortinas, suportes — montamos hoje.",
    description:
      "Profissionais especializados em montagem de móveis novos e remontagem após mudança. Furos, fixação de quadros, suportes e prateleiras com nivelamento profissional.",
    icon: Hammer,
    beneficios: [
      "Ferramentas próprias e bucha certa para cada parede",
      "Sem furo errado: marcação prévia e nivelamento a laser",
      "Atendimento no mesmo dia em toda a cidade",
    ],
  },
  reparos: {
    slug: "reparos",
    nome: "reparos",
    titulo: "Reparos elétricos, hidráulica e pintura",
    subtitulo: "Vazamentos, tomadas, lustres, retoques de pintura e gesso.",
    description:
      "Pequenos reparos resolvidos com técnica e segurança. Troca de resistência, conserto de descarga, instalação de luminárias, retoque de paredes e reparos em gesso.",
    icon: Wrench,
    beneficios: [
      "Garantia de 30 dias em qualquer reparo",
      "Profissionais com NR-10 para serviços elétricos",
      "Limpeza do ambiente após o serviço",
    ],
  },
  engenharia: {
    slug: "engenharia",
    nome: "engenharia",
    titulo: "Engenharia, legalização e segurança do trabalho",
    subtitulo: "Habite-se, alvarás, regularização de obras e laudos técnicos.",
    description:
      "Equipe técnica para aprovação de projetos, regularização junto à prefeitura, emissão de laudos e treinamentos de NRs. Cuidamos da burocracia para você focar na obra.",
    icon: Scale,
    beneficios: [
      "Engenheiros responsáveis com ART/RRT",
      "Acompanhamento até o protocolo e aprovação",
      "Diagnóstico inicial gratuito por WhatsApp",
    ],
  },
};

type Servico = {
  id: string;
  nome: string;
  preco_min: number | null;
  preco_max: number | null;
  descricao: string | null;
};

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export const Route = createFileRoute("/servicos/$categoria")({
  beforeLoad: ({ params }) => {
    if (!categorias[params.categoria]) throw notFound();
  },
  head: ({ params }) => {
    const cat = categorias[params.categoria];
    if (!cat) return {};
    return {
      meta: [
        { title: `${cat.titulo} | Marido pra Quê?` },
        { name: "description", content: cat.description },
        { property: "og:title", content: cat.titulo },
        { property: "og:description", content: cat.subtitulo },
      ],
    };
  },
  component: CategoriaPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Categoria não encontrada</h1>
      <p className="mt-4 text-muted-foreground">
        A categoria que você buscou não existe.
      </p>
      <Button asChild className="mt-8 rounded-full" variant="brand">
        <Link to="/servicos">Ver todos os serviços</Link>
      </Button>
    </div>
  ),
});

function CategoriaPage() {
  const { categoria } = Route.useParams();
  const cat = categorias[categoria]!;
  const Icon = cat.icon;
  const [servicos, setServicos] = useState<Servico[]>([]);

  useEffect(() => {
    supabase
      .from("services_catalog")
      .select("id, nome, preco_min, preco_max, descricao")
      .eq("ativo", true)
      .eq("categoria", cat.nome)
      .then(({ data }) => setServicos((data ?? []) as Servico[]));
  }, [cat.nome]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
      <Link
        to="/servicos"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← Todos os serviços
      </Link>

      <header className="mt-8 grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Categoria
          </span>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            {cat.titulo}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{cat.subtitulo}</p>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-brand-foreground shadow-brand">
          <Icon className="h-8 w-8" />
        </div>
      </header>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {cat.beneficios.map((b) => (
          <div
            key={b}
            className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <span>{b}</span>
          </div>
        ))}
      </div>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">
          Serviços nesta categoria
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Preços tabelados. Solicite seu orçamento e o profissional confirma o valor exato.
        </p>

        {servicos.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">
            Carregando serviços…
          </p>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {servicos.map((s) => (
              <article
                key={s.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 transition hover:shadow-soft"
              >
                <div>
                  <h3 className="text-lg font-semibold">{s.nome}</h3>
                  {s.descricao && (
                    <p className="mt-2 text-sm text-muted-foreground">{s.descricao}</p>
                  )}
                  {s.preco_min != null && s.preco_max != null && (
                    <p className="mt-4 text-sm">
                      <span className="text-muted-foreground">Faixa: </span>
                      <span className="font-semibold">
                        {brl(Number(s.preco_min))} a {brl(Number(s.preco_max))}
                      </span>
                    </p>
                  )}
                </div>
                <Button
                  asChild
                  variant="brand"
                  size="sm"
                  className="mt-6 self-start rounded-full"
                >
                  <Link to="/orcamentos">
                    Pedir orçamento <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-20 rounded-3xl bg-foreground p-10 text-center text-background md:p-16">
        <h2 className="text-balance text-3xl font-semibold md:text-4xl">
          Pronto para resolver?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-background/70">
          Em 2 minutos você descreve o serviço e recebe a confirmação do profissional.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild variant="brand" size="xl">
            <Link to="/orcamentos" search={{ new: 1 }}>
              Pedir orçamento agora <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
