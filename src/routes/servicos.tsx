import { createFileRoute, Link } from "@tanstack/react-router";
import { Hammer, Wrench, Scale, Package, Loader2 } from "lucide-react";
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

const categoriaMeta: Record<string, { titulo: string; description: string; icon: typeof Hammer }> = {
  montagem: {
    titulo: "Montagem e Instalação",
    description: "Móveis, suportes, prateleiras, cortinas — tudo no lugar com nivelamento profissional.",
    icon: Hammer,
  },
  reparos: {
    titulo: "Reparos e Manutenção",
    description: "Pequenos reparos resolvidos com técnica e segurança: elétrica, hidráulica, pintura.",
    icon: Wrench,
  },
  engenharia: {
    titulo: "Engenharia e Legalização",
    description: "Aprovação de projetos, alvarás, laudos e segurança do trabalho com responsável técnico.",
    icon: Scale,
  },
};

const fallbackMeta = { titulo: "Outros serviços", description: "Mais serviços do nosso catálogo.", icon: Package };

const WHATSAPP = "https://wa.me/5521999999999?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20os%20serviços.";

const brl = (v: number) => `R$ ${Math.round(v)}`;

function Servicos() {
  const [servicos, setServicos] = useState<Servico[] | null>(null);

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
    // ordem preferida
    const order = ["montagem", "reparos", "engenharia"];
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ia = order.indexOf(a); const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [servicos]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="mb-20">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Catálogo Completo</span>
        <h1 className="mt-3 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          Nossos Serviços Especializados.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Preços tabelados e atualizados em tempo real. Materiais opcionais discriminados no orçamento.
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
          return (
            <section id={categoria} key={categoria} className="relative scroll-mt-32">
              <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
                <div className="sticky top-24 self-start">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-brand-foreground shadow-brand mb-6">
                    <Icon className="h-8 w-8" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight">{meta.titulo}</h2>
                  <p className="mt-4 text-muted-foreground leading-relaxed">{meta.description}</p>
                </div>

                <div className="grid gap-6">
                  {items.map((item) => {
                    const min = item.preco_min != null ? Number(item.preco_min) : null;
                    const max = item.preco_max != null ? Number(item.preco_max) : null;
                    const priceLabel =
                      min != null && max != null
                        ? min === max ? brl(min) : `${brl(min)} – ${brl(max)}`
                        : "Sob consulta";
                    return (
                      <div key={item.id} className="group rounded-3xl border border-border bg-card p-8 transition hover:shadow-soft">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                            {item.nome}
                          </h3>
                          <span className="rounded-full bg-brand-soft px-4 py-1.5 text-sm font-bold text-brand whitespace-nowrap">
                            {priceLabel}
                          </span>
                        </div>
                        {item.descricao && (
                          <p className="mt-4 text-muted-foreground leading-relaxed">{item.descricao}</p>
                        )}

                        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            * Materiais opcionais à parte • Sem compromisso até você aprovar
                          </p>
                          <Button asChild size="sm" className="rounded-full bg-brand text-brand-foreground shadow-brand hover:scale-105">
                            <Link to="/orcamentos" search={{ new: 1, serviceId: item.id }}>
                              Solicitar Orçamento →
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
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
