# Checkout Transparente (Payment Brick) com split

## Objetivo
O cliente paga com cartão **sem sair do site**. O formulário é renderizado dentro do `/checkout`, o token é gerado no navegador pelo SDK do MP, e o pagamento é criado no backend com o `access_token` do profissional (split 1:1), usando `application_fee` em vez de `marketplace_fee`. Isso elimina o problema do botão cinza no Checkout Pro.

## Mudanças

### 1. Frontend — `src/routes/checkout.tsx`
- Carregar o SDK do MP (`https://sdk.mercadopago.com/js/v2`) sob demanda quando o método "cartão" estiver ativo.
- Substituir o botão "Pagar com Cartão" (que faz redirect) por um container `<div id="payment-brick">` onde o Payment Brick é montado.
- Inicializar o Brick com o **`mp_public_key` do profissional** (buscado junto com o orçamento).
- No `onSubmit` do Brick, chamar a nova edge function `mercadopago-cartao-processar` passando `{ orcamentoId, formData }`.
- Mostrar estado de sucesso/recusa imediatamente (o `/v1/payments` responde síncrono com `approved` / `in_process` / `rejected`).
- Em sucesso, redirecionar para `/cliente?tab=pedidos&payment=success`.

### 2. Nova edge function — `supabase/functions/mercadopago-cartao-processar/index.ts`
- Recebe `{ orcamentoId, formData }` (token, payment_method_id, installments, issuer_id, payer).
- Reaproveita as validações da `mercadopago-cartao-criar` (posse do orçamento, status `aprovado`, valor, cálculo do `valor_apoio`, busca do `mp_access_token` do profissional, expiração).
- Cria registro em `pagamentos` com status `pending`.
- POST em `https://api.mercadopago.com/v1/payments` com header `X-Idempotency-Key: <pagamento_id>`, usando `Authorization: Bearer <seller_access_token>` e body:
  - `transaction_amount`, `token`, `payment_method_id`, `installments`, `issuer_id`
  - `payer: { email, identification }`
  - `application_fee` = marketplace fee + valor apoio (substitui o antigo `marketplace_fee`)
  - `external_reference: orcamento.id`
  - `notification_url` = webhook atual `mercado-pago-webhook`
  - `metadata: { orcamento_id, pagamento_id, cliente_id }`
  - `statement_descriptor: "MARIDO PRA QUE"`
- Atualiza `pagamentos` com `gateway_payment_id` e `status` (`approved` → `pago`, `in_process` → `pending`, `rejected` → `failed`).
- Retorna `{ ok, status, status_detail, pagamentoId }`.

### 3. Edge function antiga
- Manter `mercadopago-cartao-criar` por ora (não remover) — pode ser apagada depois que confirmarmos o fluxo novo.

### 4. Webhook
- `mercado-pago-webhook` já trata `payment.updated` por `external_reference` — nenhuma mudança necessária.

## Detalhes técnicos

**Por que `application_fee` em vez de `marketplace_fee`:** no `/v1/payments` (transparente) o parâmetro chama-se `application_fee`. No `/checkout/preferences` (Pro) chama-se `marketplace_fee`. Mesmo significado, nomes diferentes por endpoint.

**Public key do profissional:** já é salvo na coluna `profissional_perfil.mp_public_key` durante o OAuth callback. Vou buscá-lo junto com o orçamento via uma consulta extra, ou expor via uma server function `getCheckoutData(orcamentoId)` que devolva `{ orcamento, materiais, mpPublicKey }`. Vou pelo caminho da server function para não vazar a coluna em uma query client direta.

**CSP:** o Brick injeta scripts inline, então a CSP atual do Lovable pode bloquear. O SDK é carregado de `https://sdk.mercadopago.com` (script externo, ok com `'strict-dynamic'`). Os iframes do Brick rodam em `*.mercadopago.com`. Se houver bloqueio, ajustamos via `frame-src` no meta — mas como o Brick não usa `<script>` inline diretamente (carrega tudo via SDK), deve passar.

## Riscos
- Se a CSP do Lovable bloquear algum recurso do Brick, ele não renderiza. Mitigação: testar em preview e, se necessário, adicionar exceções específicas no meta CSP (sem `strict-dynamic`).
- Cartões salvos: a primeira versão pedirá o cartão a cada compra. Cartões salvos (Customer + Card) é uma evolução posterior.

Posso seguir?
