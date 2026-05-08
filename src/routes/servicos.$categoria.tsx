import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  Hammer, Wrench, Scale, ArrowRight, CheckCircle2, Search, X,
  Clock, ListChecks, Info, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";

type CategoryMeta = {
  slug: string;
  nome: string;
  titulo: string;
  subtitulo: string;
  description: string;
  icon: typeof Hammer;
  beneficios: string[];
  observacoesPadrao: string[];
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
    observacoesPadrao: [
      "Tenha o manual ou link do produto à mão para conferência rápida.",
      "Limpamos o ambiente ao final; resíduos de embalagem são descartados.",
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
    observacoesPadrao: [
      "Em reparos elétricos é necessário desligar o disjuntor por alguns minutos.",
      "Vazamentos antigos podem revelar danos adicionais — diagnóstico no local.",
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
    observacoesPadrao: [
      "Prazos dependem do órgão público — informamos a previsão na visita técnica.",
      "Documentos do imóvel (matrícula/IPTU) agilizam a abertura do processo.",
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
type ServiceMaterial = { service_id: string; material_id: string; quantidade_sugerida: number };
type Material = { id: string; nome: string; unidade: string };

const brl = (v: number) => `R$ ${v.toFixed(0)}`;

// ~R$ 80/h de mão de obra; mínimo 30min, máximo 8h
function estimarTempo(min: number | null, max: number | null): string {
  if (min == null || max == null) return "Sob consulta";
  const media = (Number(min) + Number(max)) / 2;
  const horas = Math.max(0.5, Math.min(8, media / 80));
  if (horas < 1) return "≈ 30 min";
  if (horas < 1.5) return "≈ 1 h";
  if (horas < 5) return `≈ ${Math.round(horas * 2) / 2} h`;
  return `≈ ${Math.round(horas)} h (½ período)`;
}

export const Route = createFileRoute("/servicos/$categoria")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
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
  const [servicos, setServicos] = useState<Servico[] | null>(null);
  const [serviceMats, setServiceMats] = useState<ServiceMaterial[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase
        .from("services_catalog")
        .select("id, nome, preco_min, preco_max, descricao")
        .eq("ativo", true)
        .eq("categoria", cat.nome)
        .order("nome"),
      supabase.from("service_materiais").select("service_id, material_id, quantidade_sugerida"),
      supabase.from("materiais").select("id, nome, unidade").eq("ativo", true),
    ]).then(([s, sm, m]) => {
      setServicos((s.data ?? []) as Servico[]);
      setServiceMats((sm.data ?? []) as ServiceMaterial[]);
      setMateriais((m.data ?? []) as Material[]);
    });
  }, [cat.nome]);

  const itensTipicosFor = (serviceId: string) =>
    serviceMats
      .filter((sm) => sm.service_id === serviceId)
      .map((sm) => {
        const mat = materiais.find((m) => m.id === sm.material_id);
        if (!mat) return null;
        return { nome: mat.nome, qtd: Number(sm.quantidade_sugerida), unidade: mat.unidade };
      })
      .filter(Boolean) as { nome: string; qtd: number; unidade: string }[];

  const filtered = useMemo(() => {
    const list = servicos ?? [];
    const term = query.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!term) return list;
    return list.filter((s) => {
      const hay = `${s.nome} ${s.descricao ?? ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return term.split(/\s+/).every((t) => hay.includes(t));
    });
  }, [servicos, query]);

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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Serviços nesta categoria
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Preços tabelados. Toque em um serviço para ver a estimativa completa.
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou palavra-chave..."
              className="pl-9 pr-9 h-11 rounded-xl"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {servicos === null ? (
          <p className="mt-10 text-sm text-muted-foreground">Carregando serviços…</p>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum serviço encontrado{query ? ` para "${query}"` : ""}.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {filtered.map((s) => {
              const isOpen = openId === s.id;
              const min = s.preco_min != null ? Number(s.preco_min) : null;
              const max = s.preco_max != null ? Number(s.preco_max) : null;
              const priceLabel =
                min != null && max != null
                  ? min === max ? brl(min) : `${brl(min)} – ${brl(max)}`
                  : "Sob consulta";
              const tempo = estimarTempo(min, max);
              const itens = itensTipicosFor(s.id);
              return (
                <article
                  key={s.id}
                  className={`flex flex-col rounded-2xl border bg-card p-6 transition ${
                    isOpen ? "border-brand shadow-soft" : "border-border hover:shadow-soft"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold">{s.nome}</h3>
                      <span className="text-sm font-bold text-brand whitespace-nowrap">{priceLabel}</span>
                    </div>
                    {s.descricao && (
                      <p className="mt-2 text-sm text-muted-foreground">{s.descricao}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : s.id)}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline self-start"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? "Ocultar estimativa" : "Ver estimativa completa"}
                    <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-3 rounded-xl bg-brand-soft/40 p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Tempo médio
                          </p>
                          <p className="mt-0.5 text-sm font-bold text-foreground">{tempo}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Faixa estimada
                          </p>
                          <p className="mt-0.5 text-sm font-bold text-foreground">{priceLabel}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <ListChecks className="h-3 w-3" /> Itens típicos
                        </p>
                        {itens.length > 0 ? (
                          <ul className="mt-1 space-y-0.5 text-xs text-foreground">
                            {itens.slice(0, 5).map((it) => (
                              <li key={it.nome} className="truncate">
                                • {it.nome}
                                {it.qtd > 1 ? ` (${it.qtd}${it.unidade !== "un" ? ` ${it.unidade}` : ""})` : ""}
                              </li>
                            ))}
                            {itens.length > 5 && (
                              <li className="text-muted-foreground">+ {itens.length - 5} outros</li>
                            )}
                          </ul>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">Nenhum material obrigatório.</p>
                        )}
                      </div>
                      {cat.observacoesPadrao.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Info className="h-3 w-3" /> Observações
                          </p>
                          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            {cat.observacoesPadrao.map((o) => (
                              <li key={o}>• {o}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    asChild
                    variant="brand"
                    size="sm"
                    className="mt-5 self-start rounded-full"
                  >
                    <Link
                      to="/orcamentos"
                      search={{ new: 1, serviceId: s.id, categoria: cat.nome }}
                    >
                      Pedir orçamento <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </article>
              );
            })}
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
