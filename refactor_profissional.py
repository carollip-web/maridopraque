import re

with open("src/routes/profissional.tsx", "r") as f:
    content = f.read()

# 1. Add state for minhasPropostas
content = content.replace(
    'const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);',
    'const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);\n  const [minhasPropostas, setMinhasPropostas] = useState<any[]>([]);'
)

# 2. Add fetching for minhasPropostas in refresh
fetch_propostas = """
      const { data: oms } = await supabase
"""
new_fetch_propostas = """
      const { data: propsData } = await supabase
        .from("propostas")
        .select("*")
        .eq("profissional_id", user.id)
        .in("orcamento_id", orcIds);
      setMinhasPropostas(propsData || []);

      const { data: oms } = await supabase
"""
content = content.replace(fetch_propostas, new_fetch_propostas)

# 3. Modify filterBy logic
old_filter_oportunidades = 'if (!(o.status === "customizado_pendente" && o.profissional_id === null && especialidades.includes(o.service_name))) return false;'
new_filter_oportunidades = 'if (!(o.status === "customizado_pendente" && !minhasPropostas.some(p => p.orcamento_id === o.id) && especialidades.includes(o.service_name))) return false;'
content = content.replace(old_filter_oportunidades, new_filter_oportunidades)

old_filter_elaboracao = 'return o.status === "customizado_pendente" && o.profissional_id === user?.id;'
new_filter_elaboracao = 'return false;'
content = content.replace(old_filter_elaboracao, new_filter_elaboracao)

old_filter_enviados = 'return o.status === "enviado" && o.profissional_id === user?.id;'
new_filter_enviados = 'return (o.status === "customizado_pendente" || o.status === "enviado") && minhasPropostas.some(p => p.orcamento_id === o.id && p.status === "pendente");'
content = content.replace(old_filter_enviados, new_filter_enviados)

# 4. Remove Elaboracao tab and fix counts
# Actually, just hiding elaboracao from the TabsList
content = re.sub(
    r'<TabsTrigger value="elaboracao"(.+?)>(\s*)<Clock4(.+?)Elaboração(\s*)<\/TabsTrigger>',
    '',
    content,
    flags=re.DOTALL
)

# 5. Fix render list logic
old_render_items = '<OrcamentosList items={filterBy(pedidosSubTab as any)}'
new_render_items = '<OrcamentosList items={filterBy(pedidosSubTab as any)} minhasPropostas={minhasPropostas}'
content = content.replace(old_render_items, new_render_items)

# 6. Update OrcamentosList props
content = content.replace(
    'disableChat?: boolean;\n}) {',
    'disableChat?: boolean;\n  minhasPropostas?: any[];\n}) {'
)
content = content.replace(
    'onRecusar={onRecusar}\n        />',
    'onRecusar={onRecusar}\n          minhaProposta={minhasPropostas?.find(p => p.orcamento_id === o.id)}\n        />'
)

# 7. Update OrcamentoCard props
content = content.replace(
    'onRecusar?: (id: string) => Promise<void>;\n  disableChat?: boolean;\n}) {',
    'onRecusar?: (id: string) => Promise<void>;\n  disableChat?: boolean;\n  minhaProposta?: any;\n}) {'
)

# 8. Update initialValor and mode
content = content.replace(
    'const initialValor = o.valor_servico ?? o.valor ?? null;',
    'const initialValor = minhaProposta?.valor_servico ?? o.valor_servico ?? o.valor ?? null;'
)
content = content.replace(
    'const [obs, setObs] = useState(o.observacoes_profissional ?? "");',
    'const [obs, setObs] = useState(minhaProposta?.observacoes ?? o.observacoes_profissional ?? "");'
)
content = content.replace(
    'const [editing, setEditing] = useState(mode === "enviar");',
    'const isOportunidade = !minhaProposta && mode === "pegar";\n  const isEnviado = !!minhaProposta && minhaProposta.status === "pendente";\n  const [editing, setEditing] = useState(isOportunidade);'
)

# 9. In handleEnviar, we don't update orcamentos, the serverFn already handles propostas!
# But we need to use the new route or we already changed it in orcamentos.functions.ts.
# We just need to change the toast message.
content = content.replace(
    'toast.success(mode === "revisar" ? "Orçamento atualizado" : "Orçamento enviado ao cliente");',
    'toast.success("Proposta enviada ao cliente!");'
)

# 10. Hide "Pegar / Elaborar depois" section, show Enviar form instead.
# Replace `{mode === "pegar" ? ... : (mode === "enviar" || (mode === "revisar" && editing)) ? ...}`
content = re.sub(
    r'\{mode === "pegar" \? \(.*?\n\s+\) : \(mode === "enviar" \|\| \(mode === "revisar" && editing\)\) \? \(',
    '{(isOportunidade || editing) ? (',
    content,
    flags=re.DOTALL
)

with open("src/routes/profissional.tsx", "w") as f:
    f.write(content)

print("Refactored profissional.tsx")
