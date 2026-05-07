## Esquema de aprovação automatizada de orçamentos

Sistema híbrido com login de profissional, auto-aprovação inteligente e notificações multi-canal.

### 1. Banco de dados (migrations)

**Tabelas novas:**

- `profiles` — dados do cliente/profissional (id → auth.users, nome, whatsapp, email, total_servicos)
- `user_roles` — papéis (cliente, profissional, admin) em tabela separada com `has_role()` SECURITY DEFINER
- `services_catalog` — catálogo de serviços com preço fixo (nome, categoria, preco_fixo, is_fixed_price)
- `orcamentos` — solicitações e orçamentos:
  - cliente_id, profissional_id (nullable até atribuição)
  - service_id (nullable se customizado), descricao
  - valor, tipo: `fixo_auto` | `customizado_pendente` | `enviado` | `aprovado` | `recusado` | `pago`
  - auto_aprovado (bool), data_aprovacao, observacoes
- `notificacoes` — fila de notificações (user_id, tipo, canal: email/whatsapp/in-app, payload, enviado_em)

**Regras (RLS):**
- Cliente vê e cria seus próprios orçamentos
- Profissional vê orçamentos atribuídos a ele e pode atualizar valor/status
- Admin vê tudo
- Catálogo de serviços é leitura pública

**Trigger automático:**
- Ao inserir orçamento, se `service_id` tem `preco_fixo` → marca `tipo='fixo_auto'`, gera valor automaticamente
- Se cliente tem ≥3 serviços pagos E valor ≤ R$200 → marca `auto_aprovado=true` direto
- Caso contrário, fica `customizado_pendente` para profissional revisar

### 2. Autenticação

- Tela de login/cadastro com email+senha (já existe `/login`)
- Cadastro define role automaticamente como `cliente`
- Profissionais são promovidos manualmente pelo admin
- Auto-confirm desativado (verificação por email)

### 3. Server functions (TanStack Start)

- `solicitarOrcamento` — cliente envia pedido; trigger DB faz a lógica
- `enviarOrcamento` — profissional define valor para customizados → status `enviado` + dispara notificação
- `aprovarOrcamento` / `recusarOrcamento` — cliente decide
- `listarMeusOrcamentos` — para cliente e profissional (com RLS)
- `enviarNotificacao` — server route que dispara email (Lovable Emails) + grava in-app

### 4. Telas (rotas novas/alteradas)

- `/cliente/orcamentos` — lista de orçamentos do cliente com status (pendente / aguardando aprovação / aprovado / pago) e botão Aprovar/Recusar/Pagar
- `/profissional` — painel do profissional com fila de "Aguardando seu orçamento" e botão para enviar valor
- `/admin` (já existe) — visão geral de todos os orçamentos
- `/servicos` — botão "Solicitar" agora cria registro real em `orcamentos` (substitui o placeholder atual)
- Sino de notificações no header passa a ler do banco em tempo real (Realtime)

### 5. Notificações

- **In-app**: tabela `notificacoes` + Supabase Realtime no sino
- **Email**: Lovable Emails — template "Orçamento pronto" com link para aprovar
- **WhatsApp**: por enquanto, link `wa.me` pré-preenchido (integração com API oficial fica para depois — exige conta business)

### 6. Fluxo end-to-end

```text
Cliente clica "Solicitar"
  ↓
INSERT orcamentos (trigger decide tipo)
  ↓
┌─ fixo_auto + recorrente + ≤R$200 → auto_aprovado → vai pra pagamento
├─ fixo_auto → status "enviado" → cliente aprova → pagamento
└─ customizado_pendente → notifica profissional → ele envia valor
                                → notifica cliente (email + in-app)
                                → cliente aprova → pagamento (Stripe já configurado)
```

### Detalhes técnicos

- **Auto-aprovação**: função SQL `should_auto_approve(cliente_id, valor)` chamada no trigger
- **Cliente recorrente**: `COUNT(*) ≥ 3` em `orcamentos WHERE status='pago'`
- **Realtime**: `ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes, orcamentos`
- **Substituir mock atual**: `useAuth.ts` e `useNotifications.ts` viram wrappers do Supabase (mantendo a API)
- **Stripe**: o checkout existente é reutilizado, recebendo `orcamento_id` e marcando `status='pago'` no webhook

Posso começar pela migration do banco assim que você aprovar.