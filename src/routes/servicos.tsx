import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Hammer,
  Wrench,
  Scale,
  ArrowRight,
  CheckCircle2,
  Drill,
  Lightbulb,
  ShowerHead,
  PaintRoller,
  FileText,
  HardHat,
  Clock,
  ListChecks,
  Info,
  Key,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Montagem, Reparos e Engenharia | Marido pra Quê?" },
      {
        name: "description",
        content:
          "Catálogo completo: montagem de móveis, reparos elétricos e hidráulicos, pintura, legalização de obras e segurança do trabalho. Preços tabelados.",
      },
      { property: "og:title", content: "Catálogo de Serviços — Marido pra Quê?" },
      {
        property: "og:description",
        content: "Tudo o que sua casa precisa, com preço tabelado e profissionais verificados.",
      },
    ],
  }),
  component: Servicos,
});

type CategoryMeta = {
  slug: string;
  nome: string;
  titulo: string;
  subtitulo: string;
  icon: typeof Hammer;
  beneficios: string[];
  observacoesPadrao: string[];
};

const categorias: CategoryMeta[] = [
  {
    slug: "montagem",
    nome: "montagem",
    titulo: "Montagem e Instalação",
    subtitulo:
      "Móveis novos ou de mudança, suportes, prateleiras, cortinas — tudo no lugar com nivelamento profissional.",
    icon: Hammer,
    beneficios: [
      "Ferramenta própria e bucha certa pra cada parede",
      "Marcação prévia e nível a laser, sem furo errado",
      "Atendimento no mesmo dia em Copacabana e Ipanema",
    ],
    observacoesPadrao: [
      "Tenha o manual ou link do produto à mão para conferência rápida.",
      "Limpamos o ambiente ao final; resíduos de embalagem são descartados.",
    ],
  },
  {
    slug: "reparos",
    nome: "reparos",
    titulo: "Reparos e Manutenção",
    subtitulo:
      "Pequenos reparos resolvidos com técnica e segurança — elétrica, hidráulica, pintura e gesso.",
    icon: Wrench,
    beneficios: [
      "Garantia de 30 dias em qualquer reparo",
      "Profissionais com NR-10 para serviços elétricos",
      "Limpeza do ambiente após o serviço",
    ],
    observacoesPadrao: [
      "Pintura em ambientes úmidos pode exigir tratamento prévio.",
      "Limpamos o ambiente ao final do serviço.",
    ],
  },
  {
    slug: "elétrica",
    nome: "elétrica",
    titulo: "Elétrica",
    subtitulo:
      "Troca de tomadas, disjuntores, chuveiros e instalação de ventilador de teto com segurança.",
    icon: Lightbulb,
    beneficios: ["Profissionais com NR-10", "Diagnóstico no local", "Garantia em todo serviço"],
    observacoesPadrao: ["Desligamos o disjuntor por alguns minutos durante o reparo."],
  },
  {
    slug: "hidráulica",
    nome: "hidráulica",
    titulo: "Hidráulica",
    subtitulo: "Vazamentos, descargas, registros, sifões, torneiras e desentupimentos.",
    icon: ShowerHead,
    beneficios: [
      "Atendimento no mesmo dia",
      "Diagnóstico antes de qualquer quebra",
      "Garantia em todo serviço",
    ],
    observacoesPadrao: [
      "Vazamentos antigos podem revelar danos adicionais — confirmamos no local.",
    ],
  },
  {
    slug: "chaveiro",
    nome: "chaveiro",
    titulo: "Chaveiro",
    subtitulo: "Abertura de porta e troca de segredo com profissional credenciado.",
    icon: Key,
    beneficios: ["Atendimento rápido em emergências", "Cilindros e segredos novos com garantia"],
    observacoesPadrao: ["Em abertura de portas pode ser necessário comprovante de residência."],
  },
  {
    slug: "instalação",
    nome: "instalação",
    titulo: "Instalação",
    subtitulo: "Rede de proteção, envelopamento de eletros, insulfilm e papel de parede.",
    icon: Drill,
    beneficios: ["Materiais e fixação adequados a cada superfície", "Acabamento profissional"],
    observacoesPadrao: ["Verificamos as medidas no local antes de iniciar a instalação."],
  },
  {
    slug: "engenharia",
    nome: "engenharia",
    titulo: "Engenharia e Legalização",
    subtitulo:
      "Aprovação de projetos, alvarás, laudos técnicos e segurança do trabalho com responsável técnico.",
    icon: Scale,
    beneficios: [
      "Engenheiros responsáveis com ART/RRT",
      "Acompanhamento até protocolo e aprovação",
      "Diagnóstico inicial gratuito",
    ],
    observacoesPadrao: [
      "Prazos dependem do órgão público — informamos a previsão na visita técnica.",
      "Documentos do imóvel (matrícula/IPTU) agilizam a abertura do processo.",
    ],
  },
];

type Servico = {
  id: string;
  nome: string;
  categoria: string;
  preco_min: number | null;
  preco_max: number | null;
  descricao: string | null;
};

const brl = (v: number) => `R$ ${v.toFixed(0)}`;

function iconFor(nome: string) {
  const n = nome.toLowerCase();
  if (/furo|fixa|parafus|broca/.test(n)) return Drill;
  if (/lâmpada|lampada|elétric|eletric|tomada|interrupt|lustre/.test(n)) return Lightbulb;
  if (/torneir|hidráulic|hidraulic|chuveir|vazament|descarga|pia|sifão|sifao/.test(n))
    return ShowerHead;
  if (/pintur|gesso|parede|retoque/.test(n)) return PaintRoller;
  if (/projeto|alvará|alvara|habite|legaliza|regulariza/.test(n)) return FileText;
  if (/segurança|seguranca|nr-?\d|laudo|treinament/.test(n)) return HardHat;
  if (/montag|móvel|movel|guarda|estante|cama|painel/.test(n)) return Hammer;
  return Wrench;
}

function estimarTempo(min: number | null, max: number | null) {
  if (min == null || max == null) return "Sob consulta";
  const media = (Number(min) + Number(max)) / 2;
  const horas = Math.max(0.5, Math.min(8, media / 80));
  if (horas < 1) return "≈ 30 min";
  if (horas < 1.5) return "≈ 1 h";
  if (horas < 5) return `≈ ${Math.round(horas * 2) / 2} h`;
  return `≈ ${Math.round(horas)} h`;
}

const CONTATO_EMAIL = "mailto:contato@maridopraque.com";

function Servicos() {
  const [servicos, setServicos] = useState<Servico[] | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(categorias[0].slug);

  useEffect(() => {
    supabase
      .from("services_catalog_publico")
      .select("id, nome, categoria, preco_min, preco_max, descricao")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setServicos((data ?? []) as Servico[]));
  }, []);

  useEffect(() => {
    if (!servicos) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let visibleCat = activeCat;
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            visibleCat = entry.target.id;
          }
        });
        if (maxRatio > 0) setActiveCat(visibleCat);
      },
      { rootMargin: "-100px 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    categorias.forEach((cat) => {
      const el = document.getElementById(cat.slug);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [servicos]);

  const handleSelectService = (id: string) => {
    setSelectedServiceId(id);
    if (window.innerWidth < 1024) {
      setIsMobileModalOpen(true);
    }
  };

  const renderCTA = () => {
    const selected = (servicos ?? []).find((s) => s.id === selectedServiceId) ?? null;
    const catOfSelected = selected ? categorias.find(c => c.nome === selected.categoria) : null;
    const min = selected?.preco_min != null ? Number(selected.preco_min) : null;
    const max = selected?.preco_max != null ? Number(selected.preco_max) : null;
    const priceLabel =
      min != null && max != null
        ? min === max
          ? brl(min)
          : `${brl(min)} – ${brl(max)}`
        : "Sob consulta";

    return (
      <div className="rounded-2xl border border-brand/30 bg-brand-soft/40 p-5 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">
          Solicitar orçamento
        </p>
        <h3 className="mt-1 text-lg font-bold">Escolha o serviço</h3>

        <div className="mt-4">
          <Select
            value={selectedServiceId}
            onValueChange={setSelectedServiceId}
            disabled={!servicos || servicos.length === 0}
          >
            <SelectTrigger className="h-11 rounded-xl bg-background">
              <SelectValue placeholder="Selecione um serviço" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map(cat => {
                const svcs = (servicos ?? []).filter(s => s.categoria === cat.nome);
                if (svcs.length === 0) return null;
                return (
                  <SelectGroup key={cat.slug}>
                    <SelectLabel>{cat.titulo}</SelectLabel>
                    {svcs.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectGroup>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {selected && (
          <div className="mt-4 space-y-3 rounded-xl bg-background/70 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Tempo médio
                </p>
                <p className="mt-0.5 text-sm font-bold">{estimarTempo(min, max)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Faixa estimada
                </p>
                <p className="mt-0.5 text-sm font-bold">{priceLabel}</p>
              </div>
            </div>
            {selected.descricao && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <ListChecks className="h-3 w-3" /> O que está incluso
                </p>
                <p className="mt-1 text-xs text-foreground">{selected.descricao}</p>
              </div>
            )}
            {catOfSelected && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" /> Observações
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {catOfSelected.observacoesPadrao.map((o) => (
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
          size="lg"
          className="mt-4 w-full rounded-full"
          disabled={!selected}
        >
          <Link
            to="/orcamentos"
            search={
              selected
                ? {
                    new: 1,
                    serviceId: selected.id,
                    categoria: selected.categoria,
                    serviceName: selected.nome,
                  }
                : { new: 1, serviceId: undefined, categoria: undefined, serviceName: undefined }
            }
          >
            Solicitar Orçamento <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-20 md:py-24">
      <div className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          Catálogo Completo
        </span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Nossos Serviços Especializados.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Cada categoria tem preço tabelado. Escolha o serviço no seletor da categoria e peça seu
          orçamento em segundos.
        </p>
      </div>

      <div className="sticky top-20 z-10 -mx-4 bg-background/95 px-4 py-3 backdrop-blur md:top-[70px] md:mx-0 md:px-0 border-b border-border mb-12">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
          {categorias.map(cat => (
            <a 
              key={cat.slug} 
              href={`#${cat.slug}`} 
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition snap-start ${
                activeCat === cat.slug ? "bg-brand text-brand-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.titulo}
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-24">
          {categorias.map((cat) => {
            const lista = (servicos ?? []).filter((s) => s.categoria === cat.nome);
            return (
              <CategoriaSection
                key={cat.slug}
                cat={cat}
                servicos={lista}
                loading={servicos === null}
                onSelectService={handleSelectService}
              />
            );
          })}
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-36">
          {renderCTA()}
        </aside>
      </div>

      <Sheet open={isMobileModalOpen} onOpenChange={setIsMobileModalOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
          {renderCTA()}
        </SheetContent>
      </Sheet>

      <div className="mt-24 rounded-3xl bg-foreground p-10 text-center text-background md:p-16">
        <h2 className="text-3xl font-bold md:text-4xl">Ficou com alguma dúvida?</h2>
        <p className="mx-auto mt-4 max-w-md text-background/70">
          Nossa equipe técnica está pronta para analisar seu caso específico e propor a melhor
          solução.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a
            href={CONTATO_EMAIL}
            className="rounded-full bg-brand px-10 py-4 font-bold text-brand-foreground shadow-brand transition hover:scale-105"
          >
            Entrar em Contato
          </a>
          <Link
            to="/ajuda"
            className="rounded-full border border-background/20 px-10 py-4 font-bold text-background transition hover:bg-background/10"
          >
            Ver Central de Ajuda
          </Link>
        </div>
      </div>
    </div>
  );
}

function CategoriaSection({
  cat,
  servicos,
  loading,
  onSelectService,
}: {
  cat: CategoryMeta;
  servicos: Servico[];
  loading: boolean;
  onSelectService: (id: string) => void;
}) {
  const Icon = cat.icon;

  return (
    <section className="scroll-mt-32" id={cat.slug}>
      {/* Cabeçalho da categoria */}
      <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-start">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-brand-foreground shadow-brand">
          <Icon className="h-8 w-8" />
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Categoria
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{cat.titulo}</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{cat.subtitulo}</p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-3">
            {cat.beneficios.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando serviços…</p>
        ) : servicos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum serviço cadastrado nesta categoria.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
            {servicos.map((s) => {
              const SIcon = iconFor(s.nome);
              const sMin = s.preco_min != null ? Number(s.preco_min) : null;
              const sMax = s.preco_max != null ? Number(s.preco_max) : null;
              const label =
                sMin != null && sMax != null
                  ? sMin === sMax
                    ? brl(sMin)
                    : `${brl(sMin)} – ${brl(sMax)}`
                  : "Sob consulta";
              
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectService(s.id)}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-brand/40 hover:shadow-soft"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <SIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2">
                      <h3 className="text-sm font-semibold text-wrap line-clamp-2">{s.nome}</h3>
                      <span className="text-xs font-bold text-brand whitespace-nowrap mt-1 sm:mt-0">
                        {label}
                      </span>
                    </div>
                    {s.descricao && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {s.descricao}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
