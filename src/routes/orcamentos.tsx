import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { decidirOrcamento, solicitarOrcamento } from "@/lib/orcamentos.functions";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Package,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Wrench,
  ClipboardCheck,
} from "lucide-react";

export const Route = createFileRoute("/orcamentos")({
  component: MeusOrcamentos,
});

type Servico = {
  id: string;
  nome: string;
  categoria: string;
  preco_min: number | null;
  preco_max: number | null;
};

type Material = {
  id: string;
  nome: string;
  unidade: string;
  preco_atual: number;
  preco_fonte: string;
};

type ServiceMaterial = {
  service_id: string;
  material_id: string;
  quantidade_sugerida: number;
};

type OrcamentoRow = {
  id: string;
  service_id: string | null;
  service_name: string;
  descricao: string | null;
  valor: number | null;
  valor_servico: number | null;
  taxa_material: number;
  status: string;
  auto_aprovado: boolean;
  observacoes_profissional: string | null;
  created_at: string;
};

type OrcMaterial = {
  id: string;
  orcamento_id: string;
  nome_snapshot: string;
  unidade_snapshot: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
};

const statusLabel: Record<string, { label: string; cls: string }> = {
  customizado_pendente: { label: "Aguardando profissional", cls: "bg-amber-50 text-amber-700" },
  fixo_auto: { label: "Pronto para aprovar", cls: "bg-blue-50 text-blue-700" },
  enviado: { label: "Aguardando sua aprovação", cls: "bg-blue-50 text-blue-700" },
  aprovado: { label: "Aprovado — pague para agendar", cls: "bg-green-50 text-green-700" },
  recusado: { label: "Recusado", cls: "bg-red-50 text-red-700" },
  pago: { label: "Pago", cls: "bg-green-50 text-green-700" },
  cancelado: { label: "Cancelado", cls: "bg-slate-100 text-slate-600" },
};

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

function MeusOrcamentos() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<OrcamentoRow[]>([]);
  const [orcMats, setOrcMats] = useState<Record<string, OrcMaterial[]>>({});
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [serviceMats, setServiceMats] = useState<ServiceMaterial[]>([]);

  const [selServiceId, setSelServiceId] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [picked, setPicked] = useState<Record<string, number>>({}); // materialId -> qty
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const solicitar = useServerFn(solicitarOrcamento);
  const decidir = useServerFn(decidirOrcamento);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const refresh = async () => {
    const { data } = await supabase
      .from("orcamentos")
      .select("*")
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as OrcamentoRow[];
    setList(rows);

    if (rows.length > 0) {
      const { data: mats } = await supabase
        .from("orcamento_materiais")
        .select("*")
        .in(
          "orcamento_id",
          rows.map((r) => r.id),
        );
      const grouped: Record<string, OrcMaterial[]> = {};
      (mats ?? []).forEach((m: any) => {
        (grouped[m.orcamento_id] ||= []).push(m as OrcMaterial);
      });
      setOrcMats(grouped);
    }
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    Promise.all([
      supabase.from("services_catalog").select("id, nome, categoria, preco_min, preco_max").eq("ativo", true),
      supabase.from("materiais").select("id, nome, unidade, preco_atual, preco_fonte").eq("ativo", true),
      supabase.from("service_materiais").select("*"),
    ]).then(([s, m, sm]) => {
      setServicos((s.data ?? []) as Servico[]);
      setMateriais((m.data ?? []).map((x: any) => ({ ...x, preco_atual: Number(x.preco_atual) })));
      setServiceMats((sm.data ?? []) as ServiceMaterial[]);
    });

    const ch = supabase
      .channel("cli-orc")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orcamentos", filter: `cliente_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const selServico = servicos.find((s) => s.id === selServiceId);
  const sugeridos = useMemo(() => {
    if (!selServiceId) return [] as Material[];
    const ids = serviceMats.filter((sm) => sm.service_id === selServiceId).map((sm) => sm.material_id);
    return materiais.filter((m) => ids.includes(m.id));
  }, [selServiceId, serviceMats, materiais]);

  const subtotalMat = useMemo(
    () =>
      Object.entries(picked).reduce((s, [id, qty]) => {
        const m = materiais.find((x) => x.id === id);
        return s + (m ? Number(m.preco_atual) * qty : 0);
      }, 0),
    [picked, materiais],
  );

  const togglePick = (id: string, defaultQty: number) => {
    setPicked((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = defaultQty;
      return next;
    });
  };

  const handleNew = async () => {
    if (!selServico) return;
    setSaving(true);
    try {
      await solicitar({
        data: {
          serviceId: selServico.id,
          serviceName: selServico.nome,
          descricao: descricao.trim() || undefined,
          materiais: Object.entries(picked).map(([materialId, quantidade]) => ({
            materialId,
            quantidade,
          })),
        },
      });
      setSelServiceId("");
      setDescricao("");
      setPicked({});
      setShowNew(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Orçamentos</h1>
          <p className="text-muted-foreground mt-1">Preço tabelado e materiais opcionais.</p>
        </div>
        <Button
          onClick={() => setShowNew(!showNew)}
          className="rounded-full bg-brand text-brand-foreground gap-2"
        >
          <Plus className="h-4 w-4" /> Nova solicitação
        </Button>
      </div>

      {showNew && (
        <div className="bg-white rounded-2xl border border-border p-6 mb-6 shadow-soft space-y-4">
          <div>
            <label className="text-xs uppercase font-bold text-muted-foreground">Serviço</label>
            <select
              value={selServiceId}
              onChange={(e) => {
                setSelServiceId(e.target.value);
                setPicked({});
              }}
              className="w-full mt-1 h-12 px-3 rounded-xl border border-border bg-slate-50"
            >
              <option value="">Selecione um serviço…</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                  {s.preco_min != null && s.preco_max != null
                    ? ` — ${brl(Number(s.preco_min))} a ${brl(Number(s.preco_max))}`
                    : ""}
                </option>
              ))}
            </select>
            {selServico && selServico.preco_min != null && selServico.preco_max != null && (
              <p className="text-xs text-muted-foreground mt-1">
                Range tabelado:{" "}
                <span className="font-semibold text-foreground">
                  {brl(Number(selServico.preco_min))} a {brl(Number(selServico.preco_max))}
                </span>
                . O profissional confirmará o valor exato dentro desse range.
              </p>
            )}
          </div>

          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={2000}
            placeholder="Descreva detalhes (opcional)"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-border bg-slate-50"
          />

          {sugeridos.length > 0 && (
            <div className="rounded-2xl bg-slate-50 border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-brand" />
                <h4 className="font-bold text-sm">Materiais opcionais</h4>
                <span className="text-xs text-muted-foreground">(taxa adicional)</span>
              </div>
              <ul className="space-y-2">
                {sugeridos.map((m) => {
                  const sm = serviceMats.find(
                    (s) => s.service_id === selServiceId && s.material_id === m.id,
                  );
                  const qtyDefault = Number(sm?.quantidade_sugerida ?? 1);
                  const checked = m.id in picked;
                  const qty = picked[m.id] ?? qtyDefault;
                  return (
                    <li key={m.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-border">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => togglePick(m.id, qtyDefault)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {brl(Number(m.preco_atual))} / {m.unidade}
                          {m.preco_fonte === "marketplace" && " · marketplace"}
                        </p>
                      </div>
                      {checked && (
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={qty}
                          onChange={(e) =>
                            setPicked((p) => ({ ...p, [m.id]: Math.max(1, Number(e.target.value) || 1) }))
                          }
                          className="w-16 h-9 px-2 rounded-lg border border-border text-sm text-right"
                        />
                      )}
                      {checked && (
                        <span className="text-sm font-bold tabular-nums w-20 text-right">
                          {brl(Number(m.preco_atual) * qty)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {Object.keys(picked).length > 0 && (
                <div className="flex justify-between items-center pt-3 mt-3 border-t border-border text-sm">
                  <span className="text-muted-foreground">Subtotal materiais</span>
                  <span className="font-bold">{brl(subtotalMat)}</span>
                </div>
              )}
            </div>
          )}

          {selServico && selServico.preco_min != null && selServico.preco_max != null && (
            <div className="rounded-2xl bg-brand/5 border border-brand/20 p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mão de obra (range)</span>
                <span>
                  {brl(Number(selServico.preco_min))} – {brl(Number(selServico.preco_max))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Materiais</span>
                <span>{brl(subtotalMat)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-brand/20">
                <span>Total estimado</span>
                <span>
                  {brl(Number(selServico.preco_min) + subtotalMat)} –{" "}
                  {brl(Number(selServico.preco_max) + subtotalMat)}
                </span>
              </div>
            </div>
          )}

          <Button
            onClick={handleNew}
            disabled={saving || !selServico}
            className="bg-foreground text-background rounded-full font-bold w-full"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar solicitação"}
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {list.length === 0 && (
          <div className="p-12 text-center text-muted-foreground bg-white rounded-2xl border border-border">
            Você ainda não tem orçamentos.{" "}
            <Link to="/servicos" className="text-brand font-bold underline">
              Ver serviços
            </Link>
          </div>
        )}
        {list.map((o) => {
          const s = statusLabel[o.status] ?? { label: o.status, cls: "bg-slate-100 text-slate-700" };
          const podeAprovar = o.status === "enviado" || o.status === "fixo_auto";
          const mats = orcMats[o.id] ?? [];
          const isOpen = !!expanded[o.id];
          return (
            <div key={o.id} className="bg-white rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-bold text-lg">{o.service_name}</h3>
                  {o.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">{o.descricao}</p>
                  )}
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${s.cls}`}>
                  {s.label}
                </span>
              </div>

              {o.valor != null && (
                <div className="mb-2">
                  <p className="text-2xl font-bold text-foreground">{brl(Number(o.valor))}</p>
                  {(Number(o.valor_servico ?? 0) > 0 || Number(o.taxa_material) > 0) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Mão de obra {brl(Number(o.valor_servico ?? 0))} · Materiais{" "}
                      {brl(Number(o.taxa_material))}
                    </p>
                  )}
                </div>
              )}

              {mats.length > 0 && (
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [o.id]: !p[o.id] }))}
                  className="text-xs text-brand font-semibold flex items-center gap-1 mb-2"
                >
                  {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {mats.length} {mats.length === 1 ? "material" : "materiais"}
                </button>
              )}
              {isOpen && mats.length > 0 && (
                <ul className="text-xs space-y-1 bg-slate-50 rounded-xl p-3 mb-3">
                  {mats.map((m) => (
                    <li key={m.id} className="flex justify-between">
                      <span>
                        {m.nome_snapshot}{" "}
                        <span className="text-muted-foreground">
                          × {Number(m.quantidade)} {m.unidade_snapshot}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums">{brl(Number(m.subtotal))}</span>
                    </li>
                  ))}
                </ul>
              )}

              {o.observacoes_profissional && (
                <p className="text-sm italic text-muted-foreground mb-3">
                  "{o.observacoes_profissional}"
                </p>
              )}
              {o.auto_aprovado && (
                <p className="text-xs text-green-700 font-medium mb-3 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Aprovado automaticamente (cliente recorrente)
                </p>
              )}

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                {podeAprovar && (
                  <>
                    <Button
                      onClick={() => decidir({ data: { orcamentoId: o.id, decisao: "aprovado" } })}
                      className="bg-green-600 hover:bg-green-700 text-white rounded-full gap-2 font-bold"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Aprovar
                    </Button>
                    <Button
                      onClick={() => decidir({ data: { orcamentoId: o.id, decisao: "recusado" } })}
                      variant="outline"
                      className="rounded-full gap-2"
                    >
                      <XCircle className="h-4 w-4" /> Recusar
                    </Button>
                  </>
                )}
                {o.status === "aprovado" && o.valor && (
                  <Button asChild className="bg-brand text-brand-foreground rounded-full font-bold">
                    <Link to="/checkout" search={{ service: o.service_name, price: Number(o.valor) }}>
                      Pagar agora
                    </Link>
                  </Button>
                )}
                {o.status === "customizado_pendente" && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Um profissional vai analisar e enviar o valor.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
