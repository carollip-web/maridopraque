import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AdminApoioFeminino() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [equipe, setEquipe] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const [pedidosRes, equipeRes] = await Promise.all([
      supabase
        .from("orcamentos")
        .select("id, service_name, status, valor, valor_servico, data_preferida, periodo_preferido, apoio_equipe_id, cliente_id")
        .eq("tipo_atendimento", "homem_com_apoio_feminino")
        .order("created_at", { ascending: false }),
      supabase
        .from("apoio_feminino_equipe")
        .select("*")
        .eq("ativo", true)
        .order("nome"),
    ]);
    setPedidos(pedidosRes.data || []);
    setEquipe(equipeRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const atribuir = async (orcamentoId: string, equipeId: string) => {
    setSaving(orcamentoId);
    const { error } = await supabase
      .from("orcamentos")
      .update({ apoio_equipe_id: equipeId || null })
      .eq("id", orcamentoId);
    setSaving(null);
    if (error) {
      toast.error("Erro ao atribuir: " + error.message);
      return;
    }
    toast.success("Apoio feminino atribuída!");
    carregar();
  };

  if (loading) return <div className="p-8 text-slate-500">Carregando...</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Apoio Feminino</h2>
      <p className="text-slate-500 mb-6">
        Atribua uma das contratadas para cada pedido. Ela recebe 30% do valor do serviço (repasse manual via PIX).
      </p>

      {pedidos.length === 0 ? (
        <p className="text-slate-400">Nenhum pedido com apoio feminino no momento.</p>
      ) : (
        <div className="space-y-4">
          {pedidos.map((p) => {
            const base = Number(p.valor || p.valor_servico || 0);
            const repasse = Math.round(base * 0.3 * 100) / 100;
            return (
              <div key={p.id} className="border border-slate-200 rounded-2xl p-5 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-800">{p.service_name}</p>
                    <p className="text-xs text-slate-500">
                      Status: {p.status}
                      {p.data_preferida && ` · ${new Date(p.data_preferida + "T00:00:00").toLocaleDateString("pt-BR")}`}
                      {p.periodo_preferido && ` · ${p.periodo_preferido}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Repasse (30%)</p>
                    <p className="text-lg font-black text-emerald-600">
                      {repasse > 0 ? `R$ ${repasse.toFixed(2)}` : "Aguardando cotação"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <label className="text-sm font-medium text-slate-600">Atribuir:</label>
                  <select
                    value={p.apoio_equipe_id || ""}
                    onChange={(e) => atribuir(p.id, e.target.value)}
                    disabled={saving === p.id}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— Não atribuída —</option>
                    {equipe.map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                  {saving === p.id && <span className="text-xs text-slate-400">Salvando...</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
