import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AdminApoioFeminino() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [equipe, setEquipe] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [novoNome, setNovoNome] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novoPix, setNovoPix] = useState("");
  const [inserindo, setInserindo] = useState(false);

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
        .order("nome"),
    ]);
    setPedidos(pedidosRes.data || []);
    setEquipe(equipeRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const alternarStatus = async (id: string, atualAtivo: boolean) => {
    const { error } = await supabase
      .from("apoio_feminino_equipe")
      .update({ ativo: !atualAtivo })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao alterar status.");
      return;
    }
    carregar();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) {
      toast.error("O nome é obrigatório.");
      return;
    }
    setInserindo(true);
    const { error } = await supabase
      .from("apoio_feminino_equipe")
      .insert({
        nome: novoNome.trim(),
        telefone: novoTelefone.trim() || null,
        chave_pix: novoPix.trim() || null,
      });
    setInserindo(false);
    if (error) {
      toast.error("Erro ao adicionar: " + error.message);
      return;
    }
    toast.success("Membro da equipe adicionada!");
    setNovoNome("");
    setNovoTelefone("");
    setNovoPix("");
    carregar();
  };

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

  const equipeAtiva = equipe.filter(m => m.ativo);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Apoio Feminino</h2>
      <p className="text-slate-500 mb-6">
        Gerencie a equipe e atribua uma das contratadas para cada pedido. Ela recebe 30% do valor do serviço (repasse manual via PIX).
      </p>

      <section className="mb-10 bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-soft">
        <h3 className="font-bold text-lg mb-4 text-slate-800">Equipe de Apoio</h3>
        
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 mb-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Nome *</label>
            <input 
              value={novoNome} onChange={e => setNovoNome(e.target.value)} 
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all" 
              placeholder="Nome da contratada"
              required
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Telefone</label>
            <input 
              value={novoTelefone} onChange={e => setNovoTelefone(e.target.value)} 
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all" 
              placeholder="(11) 99999-9999"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Chave PIX</label>
            <input 
              value={novoPix} onChange={e => setNovoPix(e.target.value)} 
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all" 
              placeholder="CPF, E-mail, Celular..."
            />
          </div>
          <Button type="submit" disabled={inserindo} className="h-11 rounded-xl font-bold bg-brand text-white hover:bg-brand/90 shrink-0 px-6">
            {inserindo ? "Adicionando..." : "Adicionar à equipe"}
          </Button>
        </form>

        {equipe.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">Nenhuma membro cadastrada na equipe.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {equipe.map((m) => (
              <div key={m.id} className={`flex flex-col p-5 rounded-2xl border ${m.ativo ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-200/60 opacity-80'} transition-all`}>
                <div className="flex justify-between items-start mb-3 gap-2">
                  <h4 className="font-bold text-slate-800 leading-tight">{m.nome}</h4>
                  <span className={`shrink-0 text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${m.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                    {m.ativo ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm text-slate-600 mb-5 flex-1">
                  <p className="flex justify-between border-b border-slate-100 pb-1.5"><span className="font-medium text-slate-400">Tel</span> <span>{m.telefone || "-"}</span></p>
                  <p className="flex justify-between pt-1"><span className="font-medium text-slate-400">PIX</span> <span className="font-mono text-xs">{m.chave_pix || "-"}</span></p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => alternarStatus(m.id, m.ativo)}
                  className={`w-full rounded-xl h-9 text-xs font-bold transition-colors ${m.ativo ? 'text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200' : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'}`}
                >
                  {m.ativo ? "Desativar Membro" : "Reativar Membro"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <h3 className="font-bold text-lg mb-4 text-slate-800">Atribuição de Pedidos</h3>

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
                    {equipeAtiva.map((m) => (
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
