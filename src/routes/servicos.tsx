import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Hammer, Wrench, Scale, Package, Loader2,
  Drill, Lightbulb, ShowerHead, PaintRoller, FileText, HardHat,
  CheckCircle2, ArrowRight, Search, Clock, ListChecks, Info, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/servicos")({
  validateSearch: (s: Record<string, unknown>) => ({
    // ?picks=montagem:uuid,reparos:uuid
    picks: typeof s.picks === "string" ? s.picks : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Serviços — Montagem, Reparos e Engenharia | Marido pra Quê?" },
      { name: "description", content: "Catálogo completo: montagem de móveis, reparos elétricos e hidráulicos, pintura, legalização de obras e segurança do trabalho. Preços tabelados." },
      { property: "og:title", content: "Catálogo de Serviços — Marido pra Quê?" },
      { property: "og:description", content: "Tudo o que sua casa precisa, com preço tabelado e profissionais verificados." },
    ],
  }),
  component: Servicos,
});

type Servico = {
  id: string;
  nome: string;
  categoria: string;
  preco_min: number | null;
  preco_max: number | null;
  descricao: string | null;
};

type ServiceMaterial = { service_id: string; material_id: string; quantidade_sugerida: number };
type Material = { id: string; nome: string; unidade: string };

type CatMeta = {
  titulo: string;
  description: string;
  icon: typeof Hammer;
  beneficios: string[];
  observacoesPadrao: string[];
};

const categoriaMeta: Record<string, CatMeta> = {
  montagem: {
    titulo: "Montagem e Instalação",
    description: "Móveis novos ou de mudança, suportes, prateleiras, cortinas — tudo no lugar com nivelamento profissional.",
    icon: Hammer,
    beneficios: [
      "Ferramenta própria e bucha certa pra cada parede",
      "Marcação prévia e nível a laser, sem furo errado",
      "Atendimento no mesmo dia em toda a cidade",
    ],
    observacoesPadrao: [
      "Tenha o manual ou link do produto à mão para conferência rápida.",
      "Limpamos o ambiente ao final; resíduos de embalagem são descartados.",
    ],
  },
  reparos: {
    titulo: "Reparos e Manutenção",
    description: "Pequenos reparos resolvidos com técnica e segurança — elétrica, hidráulica, pintura e gesso.",
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
    titulo: "Engenharia e Legalização",
    description: "Aprovação de projetos, alvarás, laudos técnicos e segurança do trabalho com responsável técnico.",
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
};

const fallbackMeta: CatMeta = {
  titulo: "Outros serviços",
  description: "Mais serviços do nosso catálogo.",
  icon: Package,
  beneficios: [],
  observacoesPadrao: [],
};

function iconForServico(nome: string, categoria: string) {
  const n = nome.toLowerCase();
  if (n.includes("furo") || n.includes("fixa")) return Drill;
  if (n.includes("eletric") || n.includes("tomada") || n.includes("lustre") || n.includes("lamp")) return Lightbulb;
  if (n.includes("hidr") || n.includes("vazam") || n.includes("torneira") || n.includes("descarg")) return ShowerHead;
  if (n.includes("pint") || n.includes("gesso")) return PaintRoller;
  if (n.includes("legali") || n.includes("projeto")) return FileText;
  if (n.includes("seguran") || n.includes("nr-")) return HardHat;
  if (n.includes("regulariza") || n.includes("habite") || n.includes("alvar")) return Scale;
  if (n.includes("montagem") || n.includes("móvel") || n.includes("guarda") || n.includes("estante")) return Hammer;
  return (categoriaMeta[categoria]?.icon ?? Package);
}

const WHATSAPP = "https://wa.me/5521999999999?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20os%20serviços.";
const STORAGE_KEY = "servicos-picks-v1";

const brl = (v: number) => `R$ ${Math.round(v)}`;

// Heurística de tempo médio: ~R$ 80/hora de mão de obra, mínimo 30min, máximo 8h.
function estimarTempo(min: number | null, max: number | null): string {
  if (min == null || max == null) return "Sob consulta";
  const media = (Number(min) + Number(max)) / 2;
  const horas = Math.max(0.5, Math.min(8, media / 80));
  if (horas < 1) return "≈ 30 min";
  if (horas < 1.5) return "≈ 1 h";
  if (horas < 5) return `≈ ${Math.round(horas * 2) / 2} h`;
  return `≈ ${Math.round(horas)} h (½ período)`;
}

function parsePicks(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  raw.split(",").forEach((pair) => {
    const [cat, id] = pair.split(":");
    if (cat && id) out[cat.trim()] = id.trim();
  });
  return out;
}
function serializePicks(picks: Record<string, string>): string | undefined {
  const entries = Object.entries(picks).filter(([, v]) => !!v);
  if (!entries.length) return undefined;
  return entries.map(([k, v]) => `${k}:${v}`).join(",");
}

function Servicos() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [servicos, setServicos] = useState<Servico[] | null>(null);
  const [serviceMats, setServiceMats] = useState<ServiceMaterial[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [picked, setPicked] = useState<Record<string, string>>(() => parsePicks(search.picks));
  const [queries, setQueries] = useState<Record<string, string>>({});

  // Hidrata da localStorage no mount, se não houver picks na URL
  useEffect(() => {
    if (search.picks) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Record<string, string>;
        if (data && typeof data === "object") setPicked(data);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persiste picks em localStorage e na URL (replace, não cria histórico)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (Object.keys(picked).length) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(picked));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
    const serialized = serializePicks(picked);
    if (serialized !== search.picks) {
      navigate({ to: "/servicos", search: { picks: serialized }, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  useEffect(() => {
    Promise.all([
      supabase
        .from("services_catalog")
        .select("id, nome, categoria, preco_min, preco_max, descricao")
        .eq("ativo", true)
        .order("categoria")
        .order("nome"),
      supabase.from("service_materiais").select("service_id, material_id, quantidade_sugerida"),
      supabase.from("materiais").select("id, nome, unidade").eq("ativo", true),
    ]).then(([s, sm, m]) => {
      setServicos((s.data ?? []) as Servico[]);
      setServiceMats((sm.data ?? []) as ServiceMaterial[]);
      setMateriais((m.data ?? []) as Material[]);
    });
  }, []);

  const grupos = useMemo(() => {
    if (!servicos) return [];
    const map = new Map<string, Servico[]>();
    servicos.forEach((s) => {
      const key = (s.categoria || "outros").toLowerCase();
      (map.get(key) ?? map.set(key, []).get(key)!).push(s);
    });
    const order = ["montagem", "reparos", "engenharia"];
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ia = order.indexOf(a); const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [servicos]);

  const itensTipicosFor = (serviceId: string) => {
    const ids = serviceMats.filter((sm) => sm.service_id === serviceId);
    return ids
      .map((sm) => {
        const mat = materiais.find((m) => m.id === sm.material_id);
        if (!mat) return null;
        return { nome: mat.nome, qtd: Number(sm.quantidade_sugerida), unidade: mat.unidade };
      })
      .filter(Boolean) as { nome: string; qtd: number; unidade: string }[];
  };

  const goToOrcamento = (categoria: string, items: Servico[]) => {
    const id = picked[categoria] || items[0]?.id;
    if (!id) return;
    navigate({ to: "/orcamentos", search: { new: 1, serviceId: id, categoria } });
  };

  const filterItems = (items: Servico[], q: string) => {
    const term = q.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!term) return items;
    return items.filter((i) => {
      const hay = `${i.nome} ${i.descricao ?? ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return term.split(/\s+/).every((t) => hay.includes(t));
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-20">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Catálogo Completo</span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Nossos Serviços Especializados.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Preços tabelados e atualizados em tempo real. Escolha a categoria, selecione o serviço e peça seu orçamento — sem compromisso até você aprovar.
        </p>
      </div>

      {!servicos && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando catálogo...
        </div>
      )}

      {servicos && servicos.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground">
          Nenhum serviço cadastrado ainda. Volte em breve ou{" "}
          <Link to="/orcamentos" search={{ new: 1 }} className="font-bold text-brand hover:underline">peça um orçamento personalizado</Link>.
        </div>
      )}

      <div className="space-y-32">
        {grupos.map(([categoria, items]) => {
          const meta = categoriaMeta[categoria] ?? { ...fallbackMeta, titulo: categoria.charAt(0).toUpperCase() + categoria.slice(1) };
          const Icon = meta.icon;
          const query = queries[categoria] ?? "";
          const filtered = filterItems(items, query);
          const selectedId = picked[categoria] && items.some((i) => i.id === picked[categoria])
            ? picked[categoria]
            : items[0]?.id || "";
          const selected = items.find((i) => i.id === selectedId);
          const min = selected?.preco_min != null ? Number(selected.preco_min) : null;
          const max = selected?.preco_max != null ? Number(selected.preco_max) : null;
          const priceLabel =
            min != null && max != null
              ? min === max ? brl(min) : `${brl(min)} – ${brl(max)}`
              : "Sob consulta";
          const tempo = estimarTempo(min, max);
          const itensTipicos = selected ? itensTipicosFor(selected.id) : [];

          return (
            <section id={categoria} key={categoria} className="relative scroll-mt-32">
              <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
                {/* Coluna esquerda: cabeçalho da categoria */}
                <div className="lg:sticky lg:top-24 self-start space-y-6">
                  <div>
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-brand-foreground shadow-brand mb-6">
                      <Icon className="h-8 w-8" />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight">{meta.titulo}</h2>
                    <p className="mt-4 text-muted-foreground leading-relaxed">{meta.description}</p>
                  </div>

                  {meta.beneficios.length > 0 && (
                    <ul className="space-y-2">
                      {meta.beneficios.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 text-brand flex-shrink-0" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Coluna direita */}
                <div className="space-y-6">
                  {/* Busca dentro da categoria */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={query}
                      onChange={(e) => setQueries((q) => ({ ...q, [categoria]: e.target.value }))}
                      placeholder={`Buscar em ${meta.titulo.toLowerCase()}...`}
                      className="pl-9 pr-9 h-11 rounded-xl"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQueries((q) => ({ ...q, [categoria]: "" }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground"
                        aria-label="Limpar busca"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      Nenhum serviço encontrado para "{query}".
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {filtered.map((item) => {
                        const ItIcon = iconForServico(item.nome, categoria);
                        const iMin = item.preco_min != null ? Number(item.preco_min) : null;
                        const iMax = item.preco_max != null ? Number(item.preco_max) : null;
                        const iPrice = iMin != null && iMax != null
                          ? iMin === iMax ? brl(iMin) : `${brl(iMin)}–${brl(iMax)}`
                          : "Sob consulta";
                        const isSel = item.id === selectedId;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setPicked((p) => ({ ...p, [categoria]: item.id }))}
                            className={`text-left rounded-2xl border bg-card p-5 transition hover:shadow-soft hover:-translate-y-0.5 ${
                              isSel ? "border-brand ring-2 ring-brand/30" : "border-border"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                                <ItIcon className="h-5 w-5" />
                              </div>
                              <span className="text-xs font-bold text-brand whitespace-nowrap">{iPrice}</span>
                            </div>
                            <h3 className="mt-4 font-bold text-foreground">{item.nome}</h3>
                            {item.descricao && (
                              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-3">{item.descricao}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* CTA único da categoria — sticky para sempre estar acessível */}
                  <div className="lg:sticky lg:bottom-6 z-10 rounded-3xl border border-brand/20 bg-brand-soft/60 backdrop-blur p-6 shadow-soft">
                    <p className="text-xs font-bold uppercase tracking-wider text-brand">Pedir orçamento desta categoria</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Selecione o serviço</label>
                        <select
                          value={selectedId}
                          onChange={(e) => setPicked((p) => ({ ...p, [categoria]: e.target.value }))}
                          className="mt-1 w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground"
                        >
                          {items.map((i) => {
                            const im = i.preco_min != null ? Number(i.preco_min) : null;
                            const iM = i.preco_max != null ? Number(i.preco_max) : null;
                            const tail = im != null && iM != null
                              ? im === iM ? ` — ${brl(im)}` : ` — ${brl(im)}–${brl(iM)}`
                              : "";
                            return (
                              <option key={i.id} value={i.id}>{i.nome}{tail}</option>
                            );
                          })}
                        </select>
                      </div>
                      <Button
                        onClick={() => goToOrcamento(categoria, items)}
                        className="h-12 rounded-xl bg-brand text-brand-foreground shadow-brand hover:scale-[1.02] sm:min-w-[200px]"
                      >
                        Solicitar Orçamento <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>

                    {/* Estimativa rica do serviço selecionado */}
                    {selected && (
                      <div className="mt-5 grid gap-4 sm:grid-cols-3 rounded-2xl bg-background/70 border border-border p-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Faixa estimada</p>
                          <p className="mt-1 text-lg font-bold text-foreground">{priceLabel}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Sem compromisso até aprovar</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Tempo médio
                          </p>
                          <p className="mt-1 text-lg font-bold text-foreground">{tempo}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">No local, ida única</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <ListChecks className="h-3 w-3" /> Itens típicos
                          </p>
                          {itensTipicos.length > 0 ? (
                            <ul className="mt-1 space-y-0.5 text-xs text-foreground">
                              {itensTipicos.slice(0, 4).map((it) => (
                                <li key={it.nome} className="truncate">
                                  • {it.nome}
                                  {it.qtd > 1 ? ` (${it.qtd}${it.unidade !== "un" ? ` ${it.unidade}` : ""})` : ""}
                                </li>
                              ))}
                              {itensTipicos.length > 4 && (
                                <li className="text-muted-foreground">+ {itensTipicos.length - 4} outros</li>
                              )}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">Nenhum material obrigatório.</p>
                          )}
                        </div>

                        {(selected.descricao || meta.observacoesPadrao.length > 0) && (
                          <div className="sm:col-span-3 border-t border-border pt-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <Info className="h-3 w-3" /> Observações
                            </p>
                            {selected.descricao && (
                              <p className="mt-1 text-xs text-foreground leading-relaxed">{selected.descricao}</p>
                            )}
                            {meta.observacoesPadrao.length > 0 && (
                              <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                                {meta.observacoesPadrao.map((o) => (
                                  <li key={o}>• {o}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
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
