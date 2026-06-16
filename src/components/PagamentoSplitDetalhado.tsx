import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldCheck,
  Hourglass,
  Banknote,
  RotateCcw,
  AlertTriangle,
  CircleDot,
  FileText,
  CreditCard,
  LogIn,
  LogOut,
  Gavel,
} from "lucide-react";

interface Props {
  orcamentoId: string;
}

type Split = {
  id: string;
  valor_total: number;
  taxa_plataforma: number;
  taxa_gateway: number;
  valor_profissional: number;
  valor_reembolso: number | null;
  status: string;
  disponivel_em: string | null;
  pago_em: string | null;
  motivo_cancelamento: string | null;
  gateway: string | null;
  gateway_payment_id: string | null;
  created_at: string;
  updated_at: string;
};

type Orcamento = {
  id: string;
  status: string;
  created_at: string;
  data_aprovacao: string | null;
  data_pagamento: string | null;
  checkin_em: string | null;
  checkout_em: string | null;
  updated_at: string;
};

const BRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const pct = (part: number, total: number) =>
  total > 0 ? `${((part / total) * 100).toFixed(1)}%` : "—";

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  aguardando_conclusao: { label: "Retido — aguarda conclusão", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Hourglass },
  disponivel: { label: "Liberado para saque", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Banknote },
  solicitado: { label: "Saque solicitado", color: "bg-sky-50 text-sky-700 border-sky-200", icon: Hourglass },
  pago: { label: "Pago ao profissional", color: "bg-green-50 text-green-700 border-green-200", icon: ShieldCheck },
  retido: { label: "Retido pela plataforma", color: "bg-slate-100 text-slate-700 border-slate-200", icon: AlertTriangle },
  cancelado: { label: "Cancelado / estornado", color: "bg-rose-50 text-rose-700 border-rose-200", icon: RotateCcw },
  em_disputa: { label: "Em disputa", color: "bg-rose-50 text-rose-700 border-rose-200", icon: Gavel },
};

export function PagamentoSplitDetalhado({ orcamentoId }: Props) {
  const [splits, setSplits] = useState<Split[]>([]);
  const [orc, setOrc] = useState<Orcamento | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data: sData }, { data: oData }] = await Promise.all([
        supabase
          .from("pagamento_splits")
          .select(
            "id, valor_total, taxa_plataforma, taxa_gateway, valor_profissional, valor_reembolso, status, disponivel_em, pago_em, motivo_cancelamento, gateway, gateway_payment_id, created_at, updated_at",
          )
          .eq("orcamento_id", orcamentoId)
          .order("created_at", { ascending: true }),
        supabase
          .from("orcamentos")
          .select("id, status, created_at, data_aprovacao, data_pagamento, checkin_em, checkout_em, updated_at")
          .eq("id", orcamentoId)
          .maybeSingle(),
      ]);
      if (active) {
        setSplits((sData as unknown as Split[]) || []);
        setOrc((oData as unknown as Orcamento) || null);
        setLoading(false);
      }
    }
    load();

    const ch = supabase
      .channel(`split-det-${orcamentoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pagamento_splits", filter: `orcamento_id=eq.${orcamentoId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orcamentos", filter: `id=eq.${orcamentoId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [orcamentoId]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-muted-foreground animate-pulse">
        Carregando detalhes financeiros…
      </div>
    );
  }

  const timeline: { at: string; label: string; icon: any; tone: string }[] = [];
  if (orc) {
    timeline.push({ at: orc.created_at, label: "Pedido criado pelo cliente", icon: FileText, tone: "text-slate-600" });
    if (orc.data_aprovacao) timeline.push({ at: orc.data_aprovacao, label: "Proposta aprovada", icon: CircleDot, tone: "text-sky-700" });
    if (orc.data_pagamento) timeline.push({ at: orc.data_pagamento, label: "Pagamento confirmado (100% retido)", icon: CreditCard, tone: "text-emerald-700" });
    if (orc.checkin_em) timeline.push({ at: orc.checkin_em, label: "Check-in do profissional", icon: LogIn, tone: "text-amber-700" });
    if (orc.checkout_em) timeline.push({ at: orc.checkout_em, label: "Check-out do profissional", icon: LogOut, tone: "text-amber-700" });
  }
  splits.forEach((s, i) => {
    timeline.push({
      at: s.created_at,
      label: `Split #${i + 1} criado — ${STATUS_META[s.status]?.label || s.status}`,
      icon: Banknote,
      tone: "text-slate-700",
    });
    if (s.pago_em)
      timeline.push({ at: s.pago_em, label: `Split #${i + 1} pago ao profissional`, icon: ShieldCheck, tone: "text-green-700" });
    if (s.motivo_cancelamento && s.updated_at !== s.created_at)
      timeline.push({
        at: s.updated_at,
        label: `Split #${i + 1} ajustado — ${s.motivo_cancelamento}`,
        icon: RotateCcw,
        tone: "text-rose-700",
      });
  });
  if (orc?.status === "em_disputa")
    timeline.push({ at: orc.updated_at, label: "Disputa aberta", icon: Gavel, tone: "text-rose-700" });

  timeline.sort((a, b) => +new Date(a.at) - +new Date(b.at));

  return (
    <div className="space-y-5">
      {/* Splits */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Splits do pagamento ({splits.length})
        </h4>
        {splits.length === 0 ? (
          <div className="rounded-2xl border bg-slate-50 p-4 text-xs text-muted-foreground">
            Nenhum split registrado para este orçamento.
          </div>
        ) : (
          splits.map((s, idx) => {
            const meta = STATUS_META[s.status] || { label: s.status, color: "bg-slate-100 text-slate-700 border-slate-200", icon: AlertTriangle };
            const Icon = meta.icon;
            const total = Number(s.valor_total) || 0;
            const reemb = Number(s.valor_reembolso || 0);
            return (
              <div key={s.id} className={`rounded-2xl border-2 ${meta.color.split(" ").pop()} bg-card p-4 space-y-3`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Split #{idx + 1}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${meta.color}`}>
                      <Icon className="h-3 w-3" /> {meta.label}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("pt-BR")}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <Cell label="Total" value={BRL(total)} sub="100%" strong />
                  <Cell label="Profissional" value={BRL(Number(s.valor_profissional))} sub={pct(Number(s.valor_profissional), total)} tone="text-emerald-700" />
                  <Cell label="Plataforma" value={BRL(Number(s.taxa_plataforma))} sub={pct(Number(s.taxa_plataforma), total)} tone="text-sky-700" />
                  <Cell label="Gateway" value={BRL(Number(s.taxa_gateway))} sub={pct(Number(s.taxa_gateway), total)} tone="text-slate-600" />
                  {reemb > 0 && (
                    <Cell label="Reembolso cliente" value={BRL(reemb)} sub={pct(reemb, total)} tone="text-rose-700" />
                  )}
                </div>

                {/* Barra de proporção */}
                {total > 0 && (
                  <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-100">
                    <div className="bg-emerald-500" style={{ width: `${(Number(s.valor_profissional) / total) * 100}%` }} />
                    <div className="bg-sky-500" style={{ width: `${(Number(s.taxa_plataforma) / total) * 100}%` }} />
                    <div className="bg-slate-400" style={{ width: `${(Number(s.taxa_gateway) / total) * 100}%` }} />
                    {reemb > 0 && <div className="bg-rose-500" style={{ width: `${(reemb / total) * 100}%` }} />}
                  </div>
                )}

                {s.motivo_cancelamento && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                    <RotateCcw className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{s.motivo_cancelamento}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  {s.gateway && <span>Gateway: <strong>{s.gateway}</strong></span>}
                  {s.gateway_payment_id && <span>Pagamento: <code>{s.gateway_payment_id}</code></span>}
                  {s.disponivel_em && <span>Liberação: {new Date(s.disponivel_em).toLocaleString("pt-BR")}</span>}
                  {s.pago_em && <span>Pago em: {new Date(s.pago_em).toLocaleString("pt-BR")}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Linha do tempo</h4>
        <ol className="relative border-l-2 border-slate-200 ml-2 space-y-3">
          {timeline.map((ev, i) => {
            const Icon = ev.icon;
            return (
              <li key={i} className="ml-4">
                <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-white border-2 border-slate-300">
                  <Icon className={`h-2.5 w-2.5 ${ev.tone}`} />
                </span>
                <div className="text-xs text-muted-foreground">{new Date(ev.at).toLocaleString("pt-BR")}</div>
                <div className={`text-sm font-medium ${ev.tone}`}>{ev.label}</div>
              </li>
            );
          })}
          {timeline.length === 0 && (
            <li className="ml-4 text-xs text-muted-foreground">Sem eventos registrados.</li>
          )}
        </ol>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  sub,
  tone,
  strong,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`${strong ? "font-bold" : "font-semibold"} ${tone || ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
