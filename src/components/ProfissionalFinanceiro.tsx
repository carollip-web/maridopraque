import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  DollarSign,
  Loader2,
  TrendingUp,
  Clock,
  Wallet,
  CheckCircle2,
  AlertCircle,
  ArrowDownToLine,
} from "lucide-react";

type Saldo = {
  saldo_disponivel: number;
  saldo_a_liberar: number;
  saldo_pago: number;
  saldo_retido: number;
};

type Split = {
  id: string;
  valor_total: number;
  valor_profissional: number;
  taxa_plataforma: number;
  taxa_gateway: number;
  status: string;
  disponivel_em: string | null;
  pago_em: string | null;
  created_at: string;
  orcamento_id: string;
  orcamentos?: { service_name: string | null; status: string | null } | null;
};

type Saque = {
  id: string;
  valor: number;
  status: string;
  pago_em: string | null;
  comprovante_url: string | null;
};

const SPLIT_STATUS: Record<string, { label: string; color: string }> = {
  aguardando_conclusao: { label: "A liberar", color: "bg-amber-100 text-amber-700" },
  disponivel: { label: "Disponível", color: "bg-emerald-100 text-emerald-700" },
  solicitado: { label: "Em saque", color: "bg-sky-100 text-sky-700" },
  pago: { label: "Pago", color: "bg-slate-100 text-slate-700" },
  retido: { label: "Retido", color: "bg-rose-100 text-rose-700" },
  estornado: { label: "Estornado", color: "bg-slate-100 text-slate-600" },
  cancelado: { label: "Cancelado", color: "bg-slate-100 text-slate-600" },
};

const SAQUE_STATUS: Record<string, { label: string; color: string }> = {
  solicitado: { label: "Solicitado", color: "bg-amber-100 text-amber-700" },
  aprovado: { label: "Aprovado", color: "bg-sky-100 text-sky-700" },
  pago: { label: "Pago", color: "bg-emerald-100 text-emerald-700" },
  recusado: { label: "Recusado", color: "bg-rose-100 text-rose-700" },
  cancelado: { label: "Cancelado", color: "bg-slate-100 text-slate-600" },
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ProfissionalFinanceiro() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [saques, setSaques] = useState<Saque[]>([]);
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: s }, { data: sp }, { data: sq }, { data: perfil }] =
      await Promise.all([
        supabase
          .from("profissional_saldos")
          .select("saldo_disponivel,saldo_a_liberar,saldo_pago,saldo_retido")
          .eq("profissional_id", user.id)
          .maybeSingle(),
        supabase
          .from("pagamento_splits")
          .select(
            "id,valor_total,valor_profissional,taxa_plataforma,taxa_gateway,status,disponivel_em,pago_em,created_at,orcamento_id,orcamentos(service_name,status)",
          )
          .eq("profissional_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("profissional_saques")
          .select(
            "id,valor,status,chave_pix,observacao,solicitado_em,aprovado_em,pago_em,comprovante_url",
          )
          .eq("profissional_id", user.id)
          .order("solicitado_em", { ascending: false })
          .limit(20),
        supabase
          .from("profissional_perfil")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

    setSaldo(
      (s as Saldo) ?? {
        saldo_disponivel: 0,
        saldo_a_liberar: 0,
        saldo_pago: 0,
        saldo_retido: 0,
      },
    );
    setSplits((sp as Split[]) ?? []);
    setSaques((sq as Saque[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const podeSacar = useMemo(
    () => Number(saldo?.saldo_disponivel ?? 0) > 0,
    [saldo],
  );

  const abrirSaque = () => {
    setValor(String(Number(saldo?.saldo_disponivel ?? 0).toFixed(2)));
    setObs("");
    setOpen(true);
  };

  const submitSaque = async () => {
    if (!user) return;
    const v = Number(String(valor).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Valor inválido");
      return;
    }
    if (v > Number(saldo?.saldo_disponivel ?? 0)) {
      toast.error("Valor maior que o saldo disponível");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("profissional_saques").insert({
      profissional_id: user.id,
      valor: v,
      observacao: obs || null,
      status: "solicitado",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Falha ao solicitar saque: " + error.message);
      return;
    }
    toast.success("Saque solicitado! O financeiro irá processar.");
    setOpen(false);
    load();
  };

  if (loading) {
    return (
      <div className="py-24 grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Financeiro</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhe seu saldo e histórico de pagamentos.
          </p>
        </div>
        <Button
          onClick={abrirSaque}
          disabled={!podeSacar}
          className="rounded-full bg-brand hover:bg-brand/90"
        >
          <ArrowDownToLine className="h-4 w-4 mr-1.5" /> Solicitar saque
        </Button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          icon={Wallet}
          label="Disponível"
          value={brl(Number(saldo?.saldo_disponivel ?? 0))}
          sub="pronto para saque"
          accent="bg-emerald-50 text-emerald-700 border-emerald-200"
        />
        <StatBox
          icon={Clock}
          label="A liberar"
          value={brl(Number(saldo?.saldo_a_liberar ?? 0))}
          sub="serviços em andamento"
          accent="bg-amber-50 text-amber-700 border-amber-200"
        />
        <StatBox
          icon={CheckCircle2}
          label="Já pago"
          value={brl(Number(saldo?.saldo_pago ?? 0))}
          sub="histórico de saques"
          accent="bg-slate-50 text-slate-700 border-slate-200"
        />
        <StatBox
          icon={TrendingUp}
          label="Retido"
          value={brl(Number(saldo?.saldo_retido ?? 0))}
          sub="em revisão"
          accent="bg-rose-50 text-rose-700 border-rose-200"
        />
      </section>

      <section className="rounded-3xl bg-white border border-border p-4 sm:p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-brand" /> Pagamentos recebidos
        </h3>
        {splits.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum pagamento ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-bold">Data</th>
                  <th className="px-3 py-2 font-bold">Serviço</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                  <th className="px-3 py-2 font-bold text-right">Bruto</th>
                  <th className="px-3 py-2 font-bold text-right">Taxa</th>
                  <th className="px-3 py-2 font-bold text-right">Você recebe</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((sp) => {
                  const meta =
                    SPLIT_STATUS[sp.status] ?? {
                      label: sp.status,
                      color: "bg-slate-100 text-slate-700",
                    };
                  const taxa = Number(sp.taxa_plataforma) + Number(sp.taxa_gateway);
                  return (
                    <tr
                      key={sp.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-3 py-2.5 text-xs text-slate-600 tabular-nums">
                        {new Date(sp.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {sp.orcamentos?.service_name ?? "Serviço"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                        {sp.status === "aguardando_conclusao" && sp.disponivel_em && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            libera{" "}
                            {new Date(sp.disponivel_em).toLocaleDateString("pt-BR")}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {brl(Number(sp.valor_total))}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">
                        − {brl(taxa)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-emerald-700">
                        {brl(Number(sp.valor_profissional))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-white border border-border p-4 sm:p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
          <ArrowDownToLine className="h-4 w-4 text-brand" /> Meus saques
        </h3>
        {saques.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum saque solicitado.
          </p>
        ) : (
          <div className="space-y-2">
            {saques.map((sq) => {
              const meta =
                SAQUE_STATUS[sq.status] ?? {
                  label: sq.status,
                  color: "bg-slate-100 text-slate-700",
                };
              return (
                <div
                  key={sq.id}
                  className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3"
                >
                  <div className="text-sm">
                    <div className="font-bold text-slate-900 tabular-nums">
                      {brl(Number(sq.valor))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Solicitado em{" "}
                      {new Date(sq.solicitado_em).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar saque</DialogTitle>
            <DialogDescription>
              O financeiro processa em até 1 dia útil. O valor será transferido para a sua
              conta Mercado Pago.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Disponível: {brl(Number(saldo?.saldo_disponivel ?? 0))}
              </p>
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea
                rows={3}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submitSaque}
              disabled={submitting}
              className="bg-brand hover:bg-brand/90"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className={`rounded-3xl border p-5 ${accent}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold opacity-90">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="text-2xl font-bold mt-2 tabular-nums">{value}</p>
      <p className="text-xs opacity-75 mt-0.5">{sub}</p>
    </div>
  );
}
