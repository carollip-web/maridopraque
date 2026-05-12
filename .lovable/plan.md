# Modo de Teste da Plataforma

Vou implementar em **4 fases**, cada uma entregando valor sozinha. Você pode pausar entre fases ou pedir para pular alguma.

---

## Fase 1 — Seed de dados de teste (base de tudo)

**Objetivo:** ter sempre um conjunto previsível de usuários e pedidos para testar.

- Edge function `seed-test-data` (protegida, só super_admin chama) que:
  - Cria/atualiza 1 admin, 3 profissionais, 5 clientes — todos com sufixo `@teste.maridopraque.local` ou flag `is_test=true` no `profiles`.
  - Cria pedidos cobrindo cada status: `customizado_pendente`, `enviado`, `aprovado`, `agendado`, `pago`, `concluido`.
  - Senha padrão única (ex: `Teste@2026!`) documentada na UI.
- Edge function `reset-test-data` que apaga tudo marcado `is_test=true` e recria do zero.
- Migração: adicionar coluna `is_test boolean default false` em `profiles` e `orcamentos`.
- Banner sutil no header quando logado como conta de teste: "🧪 Conta de teste".

## Fase 2 — Painel Modo Demo no /admin

**Objetivo:** botões para disparar ações e avançar fluxos sem trocar de conta.

- Nova aba `/admin` → "Modo Teste" (visível só para super_admin).
- Cards:
  - **Contas de teste** — lista todas as contas `is_test`, com email/senha e botão "Copiar credenciais".
  - **Seed/Reset** — chama as edge functions da Fase 1.
  - **Simular fluxo** — selecionar um pedido de teste e botões: "Enviar orçamento", "Aprovar", "Agendar", "Marcar pago", "Concluir". Cada um chama um server function que avança o status.
  - **Criar pedido fake** — formulário rápido (cliente + serviço) que insere um orçamento `is_test=true`.

## Fase 3 — Impersonação (logar como)

**Objetivo:** super_admin entra como qualquer usuário em 1 clique.

- Edge function `impersonate-user` (super_admin only):
  - Recebe `user_id`, valida que o alvo é `is_test=true` (segurança: só permite impersonar contas de teste por padrão; flag opcional para liberar contas reais).
  - Usa `supabase.auth.admin.generateLink({ type: 'magiclink' })` e devolve o link.
- Botão "Entrar como" em cada conta de teste do painel.
- Ao clicar: abre nova aba com o magic link → sessão da conta alvo.
- Banner laranja persistente "Você está vendo como [nome] — sair da impersonação".

## Fase 4 — Testes E2E automatizados (Playwright)

**Objetivo:** rodar o fluxo cliente → profissional → admin de uma vez via terminal.

- `bun add -d @playwright/test` + `bunx playwright install chromium`.
- Pasta `tests/e2e/`:
  - `fluxo-completo.spec.ts` — cliente cria pedido → profissional envia orçamento → cliente aprova → profissional faz check-in/out → cliente avalia → admin vê tudo.
  - `auth.spec.ts` — login dos 3 perfis, redirect correto.
  - `helpers/` — login utilitário, seed via API.
- Script `bun test:e2e` no `package.json`.
- README curto explicando como rodar local e contra a preview publicada.

---

## Detalhes técnicos

- **Segurança das edge functions de teste:** todas validam `super_admin` via `user_roles.admin_level`. `seed/reset` recusam executar em produção se não houver flag `ENABLE_TEST_MODE=true` nos secrets (você habilita só onde quiser).
- **Isolamento:** flag `is_test` em `profiles` e `orcamentos` permite filtrar facilmente em queries do admin "real" para não poluir métricas — adicionarei filtros `.eq('is_test', false)` nos dashboards de produção.
- **Senhas de teste:** geradas determinísticas (`Teste@2026!`) e exibidas no painel. Não envia email de confirmação (auto-confirm via `auth.admin.createUser`).
- **Playwright contra preview publicada:** usa `https://maridopraque.lovable.app` por padrão; variável `BASE_URL` para apontar local.

---

## Por onde começar?

Sugiro **Fase 1 primeiro** porque tudo depende dela. Quer que eu comece por ela, ou prefere uma ordem diferente?
