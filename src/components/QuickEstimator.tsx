import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Servico = {
  id: string;
  nome: string;
  categoria: string;
  preco_min: number | null;
  preco_max: number | null;
};

const brl = (v: number) => `R$ ${v.toFixed(0).replace(".", ",")}`;

const categoriaLabel: Record<string, string> = {
  montagem: "Montagem & instalação",
  reparos: "Reparos & manutenção",
  engenharia: "Engenharia & legalização",
};

export function QuickEstimator() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [categoria, setCategoria] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");

  useEffect(() => {
    supabase
      .from("services_catalog")
      .select("id, nome, categoria, preco_min, preco_max")
      .eq("ativo", true)
      .then(({ data }) => setServicos((data ?? []) as Servico[]));
  }, []);

  const categorias = useMemo(
    () => Array.from(new Set(servicos.map((s) => s.categoria))),
    [servicos],
  );

  const servicosFiltrados = useMemo(
    () =>
      servicos.filter(
        (s) => (!categoria || s.categoria === categoria) && s.preco_min != null && s.preco_max != null,
      ),
    [servicos, categoria],
  );

  const selected = servicos.find((s) => s.id === serviceId);

  return (
    <section className="border-y border-border bg-cream/40 py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-[1fr_1.4fr] md:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand">
            <Sparkles className="h-3.5 w-3.5" /> Estimador rápido
          </span>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Em 30 segundos, descubra quanto custa.
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Escolha a categoria e o serviço. Mostramos a faixa de preço tabelada na hora —
            sem precisar fazer cadastro.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Categoria
              </label>
              <select
                value={categoria}
                onChange={(e) => {
                  setCategoria(e.target.value);
                  setServiceId("");
                }}
                className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {categoriaLabel[c] ?? c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Serviço
              </label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">Selecione…</option>
                {servicosFiltrados.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-brand-soft/60 p-5 text-center">
            {selected && selected.preco_min != null && selected.preco_max != null ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                  Faixa estimada
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">
                  {brl(Number(selected.preco_min))} – {brl(Number(selected.preco_max))}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Valor exato confirmado pelo profissional. Materiais à parte.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um serviço para ver a faixa de preço.
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="brand" size="lg" className="flex-1">
              <Link
                to="/orcamentos"
                search={
                  selected
                    ? { new: 1, serviceId: selected.id, categoria: selected.categoria }
                    : { new: 1 }
                }
              >
                Pedir orçamento <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1">
              <Link
                to="/servicos"
                search={selected ? { picks: `${selected.categoria}:${selected.id}` } : {}}
                hash={selected?.categoria}
              >
                Ver catálogo completo
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
