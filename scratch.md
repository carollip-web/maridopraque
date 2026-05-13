Plan for materials in profissional.tsx:

1. `const [materiaisCat, setMateriaisCat] = useState<any[]>([]);`
2. `refresh()` fetches `materiais`:
   `const { data: matsData } = await supabase.from('materiais').select('id, nome, unidade, preco_atual').eq('ativo', true);`
   `setMateriaisCat(matsData || []);`
3. Pass `materiaisCat` down to `OrcamentoCard`.
4. Inside `OrcamentoCard`:
   - Initialize `picked` state with the `materiais` from `o` (if `isOportunidade`), or from `minhaProposta.materiais` if `minhaProposta` is present. Wait, `proposta_materiais` is NOT being fetched in `profissional.tsx`! I need to fetch `proposta_materiais` as well in `refresh()`.
   - Wait, `minhasPropostas` only contains `propostas` table rows. I also need to fetch `proposta_materiais` for these proposals to populate the `picked` state.
   - `const { data: propMatsData } = await (supabase as any).from('proposta_materiais').select('*').in('proposta_id', propostas.map(p => p.id));`
   - Map them to `minhasPropostas`.
