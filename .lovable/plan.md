## Objetivo

Trocar o checkout (hoje Mercado Pago) por **Pix BTG cash-in**. O cliente vê QR Code + Pix copia-e-cola na tela, paga, e o status é confirmado por **webhook do BTG** com **polling** como fallback (porque a doc do BTG diz que o webhook em sandbox ainda está "em desenvolvimento").

Achei a doc do webhook de cash-in que estava faltando:
- Eventos: `instant-collection.paid` e `instant-collection.unlinked`
- Auth: header `Authorization: Bearer <webhook-secret>` (timing-safe compare)
- Payload do `.paid` traz `txId`, `status: "PAID"`, `paidAt`, `paidAmount`, `paidBy.{taxId,name}`

---

## Etapa 1 — Migration: tabela `btg_cobrancas` (Caminho A)

- `id`, `orcamento_id`, `pagamento_id`, `cliente_id`
- `tx_id` (text, único — ID da cobrança no BTG)
- `emv` (Pix copia-e-cola), `qrcode_url`, `amount`
- `status`: `ativa | paga | expirada | desvinculada | falhou`
- `expires_at`, `paid_at`, `paid_amount`, `payer_tax_id`, `payer_name`
- `btg_request` (jsonb), `btg_response` (jsonb), `created_at`, `updated_at`

**RLS:** cliente vê as suas (`cliente_id = auth.uid()`); financeiro/super_admin vê tudo; insert/update só via service role.

**Índice único parcial** `(orcamento_id) WHERE status='ativa'` → garante 1 cobrança ativa por orçamento (idempotência real, substitui o TODO do código).

**Realtime** habilitado nessa tabela (pro frontend reagir sem polling).

---

## Etapa 2 — Atualizar `btg-cobranca-criar`

- Antes de chamar a BTG: SELECT em `btg_cobrancas` por `orcamento_id` + `status='ativa'` + `expires_at > now()` → se existir, retorna a mesma (sem nova chamada à BTG).
- Após sucesso da BTG: INSERT em `btg_cobrancas`. Também cria registro em `pagamentos` (gateway = `btg_pix`, status = `pending`, valor = `valor_servico`) e grava o id no `btg_cobrancas.pagamento_id`.
- Mantém validação de scope `pix-cash-in` que já existe.

---

## Etapa 3 — Trocar o checkout (frontend)

`src/routes/checkout.tsx`:
- **Remover** chamada a `iniciarPagamentoOrcamento` (Mercado Pago).
- Substituir por `supabase.functions.invoke("btg-cobranca-criar", { body: { orcamentoId } })`.
- Mostrar QR Code (imagem `qrcode_url`) + botão "Copiar código Pix" (campo `emv`) + valor + countdown da expiração.
- Subscrever Realtime na linha da cobrança: quando `status` virar `paga`, mostrar "Pagamento confirmado ✓" e redirecionar para `/cliente?tab=pedidos&payment=success`.
- Polling de segurança: a cada 8 s chama a edge function `btg-cobranca-status` (Etapa 5) — só executa se Realtime não respondeu.

`pagamentos.functions.ts`: deixa `iniciarPagamentoOrcamento` no arquivo mas marcado como deprecated (não é mais chamado pelo checkout).

---

## Etapa 4 — Webhook `btg-pix-webhook` (NOVO)

`supabase/functions/btg-pix-webhook/index.ts` + `verify_jwt = false` em `supabase/config.toml`.

- Lê header `Authorization: Bearer <secret>` e compara com `BTG_WEBHOOK_SECRET` (timing-safe).
- Body: `{ webhookId, event, data }`. Eventos tratados:
  - `instant-collection.paid` → update `btg_cobrancas` (`status='paga'`, `paid_at`, `paid_amount`, `payer_*`, `btg_response=data`) by `tx_id = data.txId`. Em seguida, marca o `pagamentos.status='approved'`, `paid_at=now()`, e chama a RPC já existente `criar_repasse_profissional_pendente(p_pagamento_id)` para gerar o repasse.
  - `instant-collection.unlinked` → marca `status='desvinculada'`.
- Sempre responde **200** quando OK (BTG retenta em 4xx/5xx).
- Logs estruturados sem vazar o secret.

**Vou pedir o secret novo `BTG_WEBHOOK_SECRET` via add_secret** depois que você aprovar o plano. Esse mesmo secret você cola no painel BTG → Developers → seu app → Webhooks, apontando para `https://rbfonmpuepqfhivvoqku.supabase.co/functions/v1/btg-pix-webhook` e assinando os eventos `instant-collection.paid` + `.unlinked`.

---

## Etapa 5 — Fallback: `btg-cobranca-status` (polling)

Como o webhook do sandbox pode não estar disponível, crio uma edge function `btg-cobranca-status` (GET, JWT obrigatório).

- Recebe `txId`, valida que pertence ao usuário (via `btg_cobrancas.cliente_id`).
- Chama `GET https://api.sandbox.empresas.btgpactual.com/v1/companies/{companyId}/pix-cash-in/instant-collections/{txId}` com o `access_token` da `marketplace_integracoes`.
- Se BTG responder `status='PAID'` e a linha local ainda não estiver `paga`, faz o mesmo update que o webhook faria (incluindo criar repasse). Idempotente.

Assim funciona mesmo sem webhook, e quando o webhook entrar no ar o polling vira só rede de proteção.

---

## Etapa 6 — Teste E2E

1. Confirmar que existe orçamento `aprovado` com `valor_servico > 0` (ou criar um via seed).
2. Logar como o cliente desse orçamento, abrir `/checkout?orcamentoId=<id>`.
3. Conferir no banco: 1 linha em `btg_cobrancas` (`status='ativa'`), 1 em `pagamentos` (`status='pending'`).
4. No painel **BTG Empresas Sandbox**, simular pagamento daquele QR (tem botão de "simular pagamento").
5. Conferir, em sequência:
   - `btg_cobrancas.status = 'paga'`, `paid_at` preenchido.
   - `pagamentos.status = 'approved'`.
   - `repasses_profissionais` nova linha com `status='pendente'` para o profissional.
   - Frontend (sem reload) trocou pra "Pagamento confirmado" e redirecionou.
6. Repetir clicando "Preparar Pagamento" 2x seguidas → deve reaproveitar a mesma cobrança (mesmo `tx_id`).

---

## Fora de escopo (não vou mexer agora)

- Remover Mercado Pago do banco/código (apenas paro de chamar). Limpeza fica para depois.
- Webhook em produção do BTG (só sandbox por enquanto).
- Mudar valor cobrado de "valor_servico" para "sinal de 50% do total" — hoje a edge cobra o `valor_servico` cheio; mantenho assim. Se quiser cobrar só o sinal, me avisa que ajusto.

---

Posso começar pela migration?
