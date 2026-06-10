import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolverDisputaOrcamento } from "@/lib/disputas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PagamentoSplitResumo } from "@/components/PagamentoSplitResumo";
import { AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const BRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export function AdminDisputas() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const resolverFn = useServerFn(resolverDisputaOrcamento);

  const { data: disputas = [], isLoading } = useQuery({
    queryKey: ["admin", "disputas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, service_name, valor, cliente_id, profissional_id, observacoes_profissional, updated_at, status")
        .eq("status", "em_disputa")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pctPrest, setPctPrest] = useState(50);
  const [pctPlat, setPctPlat] = useState(7.5);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const pctReemb = Math.max(0, 100 - pctPrest - pctPlat);
  const selected = disputas.find((d: any) => d.id === selectedId);

  async function handleResolver() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const { ok, error } = await resolverFn({
        data: { orcamentoId: selectedId, pctPrestador: pctPrest, pctPlataforma: pctPlat, motivo },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!ok) throw new Error(error || "Falha ao resolver");
      toast.success("Disputa resolvida e estorno disparado.");
      qc.invalidateQueries({ queryKey: ["admin", "disputas"] });
      setSelectedId(null);
      setMotivo("");
    } catch (e: any) {
      toast.error("Erro ao resolver disputa", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Disputas</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pedidos sinalizados como “em disputa”. Resolva manualmente definindo o split final.
        </p>
      </header>

      {isLoading ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">Carregando…</div>
      ) : disputas.length === 0 ? (
        <div className="rounded-2xl border bg-emerald-50 p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
          <p className="text-emerald-800 font-semibold">Nenhuma disputa em aberto.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            {disputas.map((d: any) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`w-full text-left rounded-2xl border p-4 transition ${
                  selectedId === d.id ? "border-brand bg-brand-soft/30" : "bg-card hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold truncate">{d.service_name || "Serviço"}</span>
                  <span className="text-xs font-semibold text-rose-700 bg-rose-50 rounded-full px-2 py-0.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> disputa
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Valor: <strong>{BRL(Number(d.valor || 0))}</strong> · atualizado{" "}
                  {new Date(d.updated_at).toLocaleString("pt-BR")}
                </div>
                {d.observacoes_profissional && (
                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">{d.observacoes_profissional}</p>
                )}
              </button>
            ))}
          </div>

          <div>
            {selected ? (
              <div className="rounded-2xl border bg-card p-6 space-y-6">
                <div>
                  <h3 className="font-bold text-lg">{selected.service_name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">ID: {selected.id}</p>
                </div>

                <PagamentoSplitResumo orcamentoId={selected.id} />

                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">% Prestador</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={pctPrest}
                        onChange={(e) => setPctPrest(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">% Plataforma</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={pctPlat}
                        onChange={(e) => setPctPlat(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">% Reembolso</Label>
                      <Input type="number" value={pctReemb.toFixed(2)} disabled />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Motivo / decisão</Label>
                    <Textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Descreva o motivo da resolução"
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setSelectedId(null)} className="flex-1">
                      Cancelar
                    </Button>
                    <Button onClick={handleResolver} disabled={loading} className="flex-1 bg-brand text-white">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Resolver disputa
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border bg-slate-50 p-10 text-center text-sm text-muted-foreground">
                Selecione uma disputa à esquerda para revisar.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
