import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck, Hourglass, Banknote, RotateCcw, AlertTriangle } from "lucide-react";

interface Props {
  orcamentoId: string;
  compact?: boolean;
  showFees?: boolean;
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
};

const BRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const STATUS_LABEL: Record<string, { label: string; color: string; icon: any }> = {
  aguardando_conclusao: { label: "Retido — aguarda conclusão", color: "bg-amber-50 text-amber-700", icon: Hourglass },
  disponivel: { label: "Liberado para saque", color: "bg-emerald-50 text-emerald-700", icon: Banknote },
  solicitado: { label: "Saque solicitado", color: "bg-sky-50 text-sky-700", icon: Hourglass },
  pago: { label: "Pago ao profissional", color: "bg-green-50 text-green-700", icon: ShieldCheck },
  retido: { label: "Retido pela plataforma", color: "bg-slate-100 text-slate-700", icon: AlertTriangle },
};

export function PagamentoSplitResumo({ orcamentoId, compact, showFees = false }: Props) {
  const { user } = useAuth();
  const [tipoAtendimento, setTipoAtendimento] = useState<string | null>(null);
  const [split, setSplit] = useState<Split | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data }, { data: orc }] = await Promise.all([
        supabase
          .from("pagamento_splits")
          .select("id, valor_total, taxa_plataforma, taxa_gateway, valor_profissional, valor_reembolso, status, disponivel_em, pago_em, motivo_cancelamento")
          .eq("orcamento_id", orcamentoId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("orcamentos")
          .select("tipo_atendimento")
          .eq("id", orcamentoId)
          .maybeSingle(),
      ]);
      if (active) {
        setSplit((data as unknown as Split) || null);
        setTipoAtendimento(((orc as any)?.tipo_atendimento as string) ?? null);
        setLoading(false);
      }
    }
    load();

    const ch = supabase
      .channel(`split-${orcamentoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pagamento_splits", filter: `orcamento_id=eq.${orcamentoId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [orcamentoId, user?.id]);

  if (loading) {
    return <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-muted-foreground animate-pulse">Carregando resumo financeiro…</div>;
  }
  if (!split) {
    return (
      <div className="rounded-2xl border bg-slate-50 p-4 text-xs text-muted-foreground">
        Resumo financeiro ficará disponível assim que o pagamento for confirmado.
      </div>
    );
  }

  const meta = STATUS_LABEL[split.status] || { label: split.status, color: "bg-slate-100 text-slate-700", icon: AlertTriangle };
  const Icon = meta.icon;
  const reemb = Number(split.valor_reembolso || 0);

  return (
    <div className={`rounded-2xl border bg-card ${compact ? "p-4" : "p-6"} space-y-4`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Resumo financeiro</h4>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.color}`}>
          <Icon className="h-3.5 w-3.5" /> {meta.label}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <Row label="Valor pago pelo cliente" value={BRL(Number(split.valor_total))} bold />
        <Row label="Retido para o profissional" value={BRL(Number(split.valor_profissional))} />
        <Row label="Comissão plataforma" value={BRL(Number(split.taxa_plataforma))} muted />
        <Row label="Taxa gateway" value={BRL(Number(split.taxa_gateway))} muted />
        {reemb > 0 && (
          <Row label="Reembolso ao cliente" value={BRL(reemb)} highlight />
        )}
      </div>

      {split.motivo_cancelamento && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          <RotateCcw className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Regra aplicada</div>
            <div className="opacity-80">{split.motivo_cancelamento}</div>
          </div>
        </div>
      )}

      {split.disponivel_em && split.status === "aguardando_conclusao" && (
        <div className="text-xs text-muted-foreground">
          Liberação prevista: {new Date(split.disponivel_em).toLocaleString("pt-BR")}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, muted, highlight }: { label: string; value: string; bold?: boolean; muted?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""} ${muted ? "text-muted-foreground" : ""} ${highlight ? "text-emerald-700 font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
