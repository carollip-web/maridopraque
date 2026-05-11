import re

with open("src/routes/profissional.tsx", "r") as f:
    content = f.read()

# 1. Add states for materiaisCat and propostas_materiais
state_str = '  const [minhasPropostas, setMinhasPropostas] = useState<any[]>([]);'
new_state_str = '  const [minhasPropostas, setMinhasPropostas] = useState<any[]>([]);\n  const [materiaisCat, setMateriaisCat] = useState<any[]>([]);\n  const [propostasMateriais, setPropostasMateriais] = useState<any[]>([]);'
content = content.replace(state_str, new_state_str)

# 2. Fetch materiaisCat and propostas_materiais
fetch_str = """      const { data: propsData } = await (supabase as any)
        .from("propostas")
        .select("*")
        .eq("profissional_id", user.id)
        .in("orcamento_id", orcIds);
      setMinhasPropostas(propsData || []);"""

new_fetch_str = """      const { data: propsData } = await (supabase as any)
        .from("propostas")
        .select("*")
        .eq("profissional_id", user.id)
        .in("orcamento_id", orcIds);
      
      const pList = propsData || [];
      setMinhasPropostas(pList);
      
      if (pList.length > 0) {
        const { data: pMatsData } = await (supabase as any)
          .from("proposta_materiais")
          .select("*")
          .in("proposta_id", pList.map((p: any) => p.id));
        setPropostasMateriais(pMatsData || []);
      }

      const { data: catMats } = await supabase.from("materiais").select("id, nome, unidade, preco_atual").eq("ativo", true);
      setMateriaisCat(catMats || []);"""

content = content.replace(fetch_str, new_fetch_str)

# 3. Update Grid to accept materiaisCat and propostasMateriais
content = content.replace(
    'disableChat?: boolean;\n  minhasPropostas?: any[];\n}) {',
    'disableChat?: boolean;\n  minhasPropostas?: any[];\n  materiaisCat?: any[];\n  propostasMateriais?: any[];\n}) {'
)
content = content.replace(
    'minhaProposta={minhasPropostas?.find(p => p.orcamento_id === o.id)}\n        />',
    'minhaProposta={minhasPropostas?.find(p => p.orcamento_id === o.id)}\n          materiaisCat={materiaisCat}\n          propostaMateriais={propostasMateriais?.filter(pm => pm.proposta_id === minhasPropostas?.find(p => p.orcamento_id === o.id)?.id)}\n        />'
)

# 4. Update the render call to pass those props
content = content.replace(
    'minhasPropostas={minhasPropostas}',
    'minhasPropostas={minhasPropostas} materiaisCat={materiaisCat} propostasMateriais={propostasMateriais}'
)

# 5. Update OrcamentoCard props
content = content.replace(
    'disableChat?: boolean;\n  minhaProposta?: any;\n}) {',
    'disableChat?: boolean;\n  minhaProposta?: any;\n  materiaisCat?: any[];\n  propostaMateriais?: any[];\n}) {'
)

# 6. Add picked state inside OrcamentoCard
picked_state = """  const [obs, setObs] = useState(minhaProposta?.observacoes ?? o.observacoes_profissional ?? "");
  const [saving, setSaving] = useState(false);"""

new_picked_state = """  const [obs, setObs] = useState(minhaProposta?.observacoes ?? o.observacoes_profissional ?? "");
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<Record<string, number>>(() => {
    if (propostaMateriais && propostaMateriais.length > 0) {
      const init: Record<string, number> = {};
      propostaMateriais.forEach(pm => init[pm.material_id] = pm.quantidade);
      return init;
    } else if (materiais && materiais.length > 0 && !minhaProposta) {
      const init: Record<string, number> = {};
      materiais.forEach(m => init[m.material_id!] = m.quantidade);
      return init;
    }
    return {};
  });"""
content = content.replace(picked_state, new_picked_state)

# 7. Update handleEnviar payload
payload_str = """      await enviar({
        data: {
          orcamentoId: o.id,
          valorServico: numValor,
          observacoes: obs.trim() || undefined,"""

new_payload_str = """      const materiaisPayload = Object.entries(picked).map(([materialId, quantidade]) => ({ materialId, quantidade }));
      await enviar({
        data: {
          orcamentoId: o.id,
          valorServico: numValor,
          observacoes: obs.trim() || undefined,
          materiais: materiaisPayload.length > 0 ? materiaisPayload : undefined,"""
content = content.replace(payload_str, new_payload_str)

# 8. Render the materials selector
mat_ui = """                {Number(o.taxa_material) > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Materiais: R$ {Number(o.taxa_material).toFixed(2)} (já cotados pelo cliente)
                  </p>
                )}
              </div>
              <div>"""

new_mat_ui = """              </div>
              <div className="pt-2">
                <label className="text-xs uppercase font-bold text-muted-foreground mb-2 block">Materiais Inclusos</label>
                <div className="space-y-2">
                  {Object.entries(picked).map(([id, qtd]) => {
                    const mat = materiaisCat?.find((m) => m.id === id);
                    if (!mat) return null;
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <div className="flex-1 text-sm">{mat.nome}</div>
                        <div className="flex items-center border border-border rounded-lg overflow-hidden h-9">
                          <button
                            type="button"
                            className="px-3 hover:bg-slate-100 font-bold"
                            onClick={() => setPicked(p => { const np = {...p}; np[id] -= 1; if (np[id] <= 0) delete np[id]; return np; })}
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-sm">{qtd}</span>
                          <button
                            type="button"
                            className="px-3 hover:bg-slate-100 font-bold"
                            onClick={() => setPicked(p => ({...p, [id]: p[id] + 1}))}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <select 
                    className="w-full mt-2 h-10 px-3 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 text-sm"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setPicked(p => ({...p, [val]: (p[val] || 0) + 1}));
                        e.target.value = "";
                      }
                    }}
                    value=""
                  >
                    <option value="" disabled>+ Adicionar material do catálogo...</option>
                    {materiaisCat?.filter(m => !picked[m.id]).map(m => (
                      <option key={m.id} value={m.id}>{m.nome} (R$ {m.preco_atual}/{m.unidade})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>"""
content = content.replace(mat_ui, new_mat_ui)

# 9. Also hide the read-only materials when editing:
read_only_mats = """        {materiais.length > 0 && (
          <div className="rounded-xl bg-slate-50 p-3 space-y-1">"""

new_read_only_mats = """        {materiais.length > 0 && !editing && (
          <div className="rounded-xl bg-slate-50 p-3 space-y-1">"""
content = content.replace(read_only_mats, new_read_only_mats)

# We also need to show the PROPOSAL materials when it's just 'info' mode or 'revisar' without editing!
# Wait, `o` has `orcamento_materiais`. But if the proposal is pending, they might be looking at their proposal.
# To keep it simple, if `propostaMateriais` exists and !editing, we show that instead of `materiais`.

with open("src/routes/profissional.tsx", "w") as f:
    f.write(content)
print("Updated profissional.tsx materials")
