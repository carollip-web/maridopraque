## Orçamento tabelado + materiais opcionais

### O que muda

1. **Remover WhatsApp como canal de orçamento** — tirar campo/menção de WhatsApp dos fluxos de solicitação, notificação e do card do orçamento. WhatsApp continua só como contato no perfil (não como canal de envio de orçamento).
2. **Orçamento tabelado** — todo serviço passa a ter `preco_min` e `preco_max` no catálogo. Cliente vê o range antes de solicitar (ex: "R$ 80–150"). Não há mais "customizado pendente sem valor": o profissional ajusta o valor *dentro* do range para fechar.
3. **Taxa opcional de material** — cada serviço tem uma lista pré-definida de materiais sugeridos. No momento da solicitação, o cliente marca quais quer incluir; o sistema soma o preço de cada material e adiciona como `taxa_material` no orçamento, discriminada item a item.
4. **Fonte de preço de material híbrida** — tabela interna como base; botão "Atualizar via marketplace" no painel admin (e opcionalmente no card do material) consulta um marketplace de materiais e atualiza `preco_atual` + `preco_fonte` + `preco_atualizado_em`.

### Banco (migration)

- `services_catalog`: adicionar `preco_min numeric`, `preco_max numeric`. Remover/depreciar `preco_fixo` (manter coluna mas não usar mais). `is_fixed_price` vira irrelevante.
- `materiais`: nova tabela — `id`, `nome`, `unidade` (un/m/kg), `preco_base numeric` (manual), `preco_atual numeric` (último valor), `preco_fonte text` (`tabela` | `marketplace`), `preco_atualizado_em timestamptz`, `marketplace_url text`, `ativo bool`.
- `service_materiais`: junção — `service_id`, `material_id`, `quantidade_sugerida numeric`. Define a lista pré-definida por serviço.
- `orcamentos`: adicionar `taxa_material numeric default 0`, `valor_servico numeric` (valor da mão de obra, dentro do range). `valor` permanece como total (`valor_servico + taxa_material`).
- `orcamento_materiais`: itens escolhidos pelo cliente — `orcamento_id`, `material_id`, `quantidade`, `preco_unitario` (snapshot no momento da solicitação), `subtotal`.
- Trigger `process_new_orcamento` atualizado: define `valor_servico` = média do range como sugestão inicial e soma `taxa_material` a partir dos itens em `orcamento_materiais`. Status inicial `customizado_pendente` (profissional confirma valor dentro do range).
- RLS: `materiais` e `service_materiais` leitura pública; admin gerencia. `orcamento_materiais` segue RLS do orçamento pai.

### Server functions (`src/lib/`)

- `solicitarOrcamento` — passa a aceitar `materiais: { materialId, quantidade }[]`. Insere o orçamento e os itens em `orcamento_materiais` em uma transação (RPC).
- `enviarOrcamento` — valida que `valor_servico` está dentro de `[preco_min, preco_max]` do serviço.
- Nova `atualizarPrecoMaterialMarketplace` — admin only; chama o marketplace, grava `preco_atual`/`preco_fonte`/`preco_atualizado_em`.
- Nova `listarMateriaisDoServico` — leitura pública para o cliente montar a lista de checkboxes.

### Marketplace de materiais

Como integração real depende de chave de API e de qual marketplace, esta versão entrega:
- estrutura completa no banco e nos server fns,
- botão "Atualizar via marketplace" que **chama um stub** retornando o preço base ± variação (placeholder claro). Quando você quiser conectar Mercado Livre / Leroy Merlin / outro, basta trocar a função `fetchMarketplacePrice` em `materiais.server.ts` — peço a chave/credencial nesse momento.

### UI

- `/orcamentos` (cliente): formulário "Nova solicitação" passa a:
  - mostrar dropdown de serviços do catálogo com range "R$ X–Y";
  - listar materiais sugeridos com checkbox + quantidade + preço unitário atual;
  - mostrar **subtotal serviço (range)** + **subtotal materiais** + **total estimado**.
  - Card do orçamento mostra discriminação: "Mão de obra: R$ X · Materiais: R$ Y" com lista expandível dos itens.
- `/profissional`: ao revisar/enviar, input de valor com helper "Range permitido R$ X–Y" e bloqueio se fora do range. Materiais aparecem só para leitura.
- `/admin`: nova aba **Materiais** com CRUD, coluna `preco_atual`, `fonte`, botão "Atualizar via marketplace" por linha.
- Remover qualquer link `wa.me`/menção a "enviar por WhatsApp" dos cards de orçamento.

### Detalhes técnicos

- Migration única com as 2 novas tabelas, alterações em `services_catalog` e `orcamentos`, RLS, e seed de ~10 materiais comuns (bucha, parafuso, fita isolante, silicone, etc.) ligados aos serviços já existentes do catálogo.
- O total do orçamento é **sempre** recalculado server-side (trigger `BEFORE INSERT/UPDATE` em `orcamento_materiais` recomputa `taxa_material` e `valor` no orçamento pai) — cliente nunca define total.
- Tipos do Supabase regeneram após a migration.
