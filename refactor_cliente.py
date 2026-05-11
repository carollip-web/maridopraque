import re

with open("src/routes/cliente.tsx", "r") as f:
    content = f.read()

# 1. Update queryFn to fetch propostas
fetch_pedidos = """      if (!user) return [];
      const { data } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("cliente_id", user.id)
        .order("created_at", { ascending: false });
      
      const list = data || [];"""

new_fetch_pedidos = """      if (!user) return [];
      const { data } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("cliente_id", user.id)
        .order("created_at", { ascending: false });
      
      const list = data || [];
      
      const orcIds = list.map(o => o.id);
      let propostas: any[] = [];
      let profsMap: Record<string, string> = {};
      if (orcIds.length > 0) {
        const { data: pData } = await (supabase as any).from("propostas").select("*").in("orcamento_id", orcIds);
        propostas = pData || [];
        const profIds = Array.from(new Set(propostas.map(p => p.profissional_id)));
        if (profIds.length > 0) {
           const { data: prData } = await supabase.from("profiles").select("id, nome").in("id", profIds);
           (prData || []).forEach(p => profsMap[p.id] = p.nome);
        }
      }
"""
content = content.replace(fetch_pedidos, new_fetch_pedidos)

# 2. Add propostas to returned mapped object
map_pedidos = """        const uiStatus = o.status === "customizado_pendente" ? "Em Análise" :
                 o.status === "enviado" ? "Aguardando Aprovação" :
                 o.status === "aprovado" ? "Agendado" : o.status;
        return {"""

new_map_pedidos = """        const propsForOrc = propostas.filter(p => p.orcamento_id === o.id).map(p => ({...p, profNome: profsMap[p.profissional_id] || "Profissional"}));
        const uiStatus = (o.status === "customizado_pendente" && propsForOrc.length > 0) ? "Aguardando Aprovação" :
                 o.status === "customizado_pendente" ? "Em Análise" :
                 o.status === "enviado" ? "Aguardando Aprovação" :
                 o.status === "aprovado" ? "Agendado" : o.status;
        return {
          propostas: propsForOrc,"""
content = content.replace(map_pedidos, new_map_pedidos)

# 3. Handle Approve logic. We need to accept a specific proposta if there are proposals!
# Oh wait, `handleApprove` currently updates `orcamentos`. Let's just create a new function or use useServerFn for `aceitarProposta`.

import_useServerFn = 'import { useQuery, useQueryClient } from "@tanstack/react-query";'
new_import_useServerFn = 'import { useQuery, useQueryClient } from "@tanstack/react-query";\nimport { useServerFn } from "@tanstack/react-start";\nimport { aceitarProposta } from "@/lib/orcamentos.functions";'
content = content.replace(import_useServerFn, new_import_useServerFn)

aceitar_proposta_hook = '  const queryClient = useQueryClient();'
new_aceitar_proposta_hook = '  const queryClient = useQueryClient();\n  const aceitarPropostaFn = useServerFn(aceitarProposta);\n  const [selectedProposta, setSelectedProposta] = useState<any>(null);'
content = content.replace(aceitar_proposta_hook, new_aceitar_proposta_hook)

# In handleApprove, call aceitarPropostaFn instead if selectedProposta exists.
handle_approve = """  const handleApprove = async () => {
    if (!selectedPedido) return;
    setApprovalStep("processing");
    const { error } = await supabase
      .from("orcamentos")
      .update({
        status: "aprovado",
        data_aprovacao: new Date().toISOString(),
        data_agendada: dataAgendada ? dataAgendada.toISOString() : null,
      })
      .eq("id", selectedPedido.id);"""

new_handle_approve = """  const handleApprove = async () => {
    if (!selectedPedido) return;
    setApprovalStep("processing");
    try {
      if (selectedProposta) {
        await aceitarPropostaFn({ data: { orcamentoId: selectedPedido.id, propostaId: selectedProposta.id } });
        if (dataAgendada) {
          await supabase.from("orcamentos").update({ data_agendada: dataAgendada.toISOString() }).eq("id", selectedPedido.id);
        }
      } else {
        const { error } = await supabase
          .from("orcamentos")
          .update({
            status: "aprovado",
            data_aprovacao: new Date().toISOString(),
            data_agendada: dataAgendada ? dataAgendada.toISOString() : null,
          })
          .eq("id", selectedPedido.id);
        if (error) throw error;
      }
    } catch (e: any) {
      toast.error("Erro ao aprovar", { description: e.message });
      setApprovalStep("confirm");
      return;
    }"""
content = content.replace(handle_approve, new_handle_approve)
# also remove the 'if (error) { ... return; }' below it
content = content.replace("""    if (error) {
      toast.error("Erro ao aprovar", { description: error.message });
      setApprovalStep("confirm");
      return;
    }""", "")

# 4. Display Propostas in the UI when the Pedido modal is open.
display_info = """                 <div className="flex gap-2">
                    {sp.status === "Em Análise" && (
                       <Button 
                         className="flex-1 bg-brand text-brand-foreground rounded-full font-bold h-12"
                         disabled
                       >
                         Buscando profissionais...
                       </Button>
                    )}"""

new_display_info = """                 
                 {sp.propostas && sp.propostas.length > 0 && sp.status === "Aguardando Aprovação" && (
                   <div className="mb-6">
                     <h4 className="font-bold mb-3 text-slate-800">Propostas Recebidas ({sp.propostas.length})</h4>
                     <div className="space-y-3">
                       {sp.propostas.map((p: any) => (
                         <div key={p.id} className="border border-border rounded-2xl p-4 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-brand/30">
                           <div>
                             <p className="font-bold text-slate-900">{p.profNome}</p>
                             <div className="text-xl font-black text-brand mt-1">R$ {Number(p.valor_servico).toFixed(2)}</div>
                             {p.observacoes && <p className="text-xs text-slate-500 mt-2 italic">"{p.observacoes}"</p>}
                           </div>
                           <Button 
                             onClick={() => {
                               setSelectedProposta(p);
                               setApprovalStep("schedule");
                             }}
                             className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 w-full sm:w-auto"
                           >
                             Aprovar Proposta
                           </Button>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
                 <div className="flex gap-2">
                    {sp.status === "Em Análise" && (
                       <Button 
                         className="flex-1 bg-brand text-brand-foreground rounded-full font-bold h-12"
                         disabled
                       >
                         Buscando profissionais...
                       </Button>
                    )}"""
content = content.replace(display_info, new_display_info)

# 5. Fix `disabled={!dataAgendada}` to be optional if they just want to accept without schedule immediately. Let's keep it as is, or remove the disabled.
# Let's remove `disabled={!dataAgendada}` from "Continuar" button to allow accepting without schedule.
content = content.replace('disabled={!dataAgendada}', '')

with open("src/routes/cliente.tsx", "w") as f:
    f.write(content)
print("Updated cliente.tsx")
