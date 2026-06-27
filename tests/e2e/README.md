# Testes E2E — Marido pra Quê?

Suite Playwright que valida login dos 3 perfis (cliente, profissional, admin) e fluxo de ponta a ponta.

## Pré-requisitos

1. **Seed de dados de teste já rodou.** Logue como super_admin em `/admin` → aba "Modo Teste" → clique em **"Criar / atualizar dados de teste"**. Isso cria as contas com sufixo `@teste.maridopraque.local` e senha `Teste@2026!`.
2. Playwright Chromium instalado:
   ```bash
   bunx playwright install chromium
   ```

## Como rodar

Contra o site publicado (default):

```bash
bun run test:e2e
```

Contra o preview/local:

```bash
BASE_URL=http://localhost:5173 bun run test:e2e
```

Com UI interativa:

```bash
bunx playwright test --ui
```

## Scripts disponíveis

| Comando                     | O que faz               |
| --------------------------- | ----------------------- |
| `bun run test:e2e`          | Roda toda a suite       |
| `bun run test:e2e:auth`     | Só os testes de login   |
| `bun run test:e2e:fluxo`    | Só o fluxo completo     |
| `bun run test:e2e:checkout` | Só o fluxo de pagamento |

## Estrutura

```
tests/e2e/
├── helpers/auth.ts        # login(), logout(), ACCOUNTS
├── auth.spec.ts           # login dos 3 perfis + redirect
├── fluxo-completo.spec.ts # cliente → profissional → admin
└── checkout.spec.ts       # guard de login + montagem do Payment Brick
```

> Há também testes unitários (lógica pura, sem browser) em `tests/unit/` —
> rode com `bun run test:unit`.

## Resetar dados

Em `/admin` → "Modo Teste" → **"Apagar dados de teste"**. Apaga tudo marcado `is_test=true` no banco e remove as contas do auth.
