import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Hammer, Wrench, Scale, Package, Loader2,
  Drill, Lightbulb, ShowerHead, PaintRoller, FileText, HardHat,
  CheckCircle2, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/servicos")({
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

type CatMeta = {
  titulo: string;
  description: string;
  icon: typeof Hammer;
  beneficios: string[];
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
  },
};

const fallbackMeta: CatMeta = {
  titulo: "Outros serviços",
  description: "Mais serviços do nosso catálogo.",
  icon: Package,
  beneficios: [],
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

const brl = (v: number) => `R$ ${Math.round(v)}`;

function Servicos() {
  const navigate = useNavigate();
  const [servicos, setServicos] = useState<Servico[] | null>(null);
  // Por categoria: serviceId selecionado no dropdown
  const [picked, setPicked] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from("services_catalog")
      .select("id, nome, categoria, preco_min, preco_max, descricao")
      .eq("ativo", true)
      .order("categoria")
      .order("nome")
      .then(({ data }) => setServicos((data ?? []) as Servico[]));
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

  const goToOrcamento = (categoria: string, items: Servico[]) => {
    const id = picked[categoria] || items[0]?.id;
    if (!id) return;
    navigate({ to: "/orcamentos", search: { new: 1, serviceId: id } });
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
          const selectedId = picked[categoria] || items[0]?.id || "";
          const selected = items.find((i) => i.id === selectedId);
          const min = selected?.preco_min != null ? Number(selected.preco_min) : null;
          const max = selected?.preco_max != null ? Number(selected.preco_max) : null;
          const priceLabel =
            min != null && max != null
              ? min === max ? brl(min) : `${brl(min)} – ${brl(max)}`
              : "Sob consulta";

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

                {/* Coluna direita: cards informativos + um único CTA com dropdown */}
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {items.map((item) => {
                      const ItIcon = iconForServico(item.nome, categoria);
                      const iMin = item.preco_min != null ? Number(item.preco_min) : null;
                      const iMax = item.preco_max != null ? Number(item.preco_max) : null;
                      const iPrice = iMin != null && iMax != null
                        ? iMin === iMax ? brl(iMin) : `${brl(iMin)}–${brl(iMax)}`
                        : "Sob consulta";
                      return (
                        <div key={item.id} className="rounded-2xl border border-border bg-card p-5 transition hover:shadow-soft hover:-translate-y-0.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                              <ItIcon className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-bold text-brand whitespace-nowrap">{iPrice}</span>
                          </div>
                          <h3 className="mt-4 font-bold text-foreground">{item.nome}</h3>
                          {item.descricao && (
                            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{item.descricao}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* CTA único da categoria com dropdown */}
                  <div className="rounded-3xl border border-brand/20 bg-brand-soft/40 p-6">
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
                    <p className="mt-3 text-xs text-muted-foreground">
                      Estimado: <span className="font-bold text-foreground">{priceLabel}</span> · Materiais opcionais discriminados na próxima etapa · Sem compromisso até você aprovar.
                    </p>
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
