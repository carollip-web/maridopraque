# Decisão: cartões salvos no Mercado Pago — ADIADO

**Data:** 2026-06-27
**Status:** Adiado (não implementado)

## Contexto

A Fase 4 do plano previa "cartões salvos no Mercado Pago (Customer + Card)"
como evolução do checkout transparente.

## Restrição descoberta

O checkout atual usa o modelo **split 1:1 de marketplace** do MP, onde o
**collector é o profissional**: cada pagamento é criado com o
`mp_access_token` do profissional + `application_fee` para a plataforma
(ver `supabase/functions/mercadopago-cartao-processar/index.ts`).

Na API do Mercado Pago, **Customers e Cards ficam vinculados à conta do
access token que os criou**. Em marketplace, isso é o token de cada vendedor.
Consequência:

> Um cartão salvo enquanto o cliente paga o **Profissional A** só pode ser
> reutilizado pagando o **Profissional A novamente**. Não há reuso entre
> profissionais diferentes.

Como num marketplace de reparos o cliente costuma contratar profissionais
diferentes a cada serviço, o reuso seria muito limitado.

Fontes (MP Developers):
- https://www.mercadopago.com.br/developers/en/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
- https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/how-tos/payment-approval/saved-cards

## Opções avaliadas

1. **Cartões salvos por-profissional** — única opção limpa na arquitetura
   atual; reuso só com o mesmo profissional. Baixo valor, alta complexidade
   num fluxo crítico.
2. **Plataforma como collector** — cartões reutilizáveis com qualquer
   profissional, mas muda quem recebe o dinheiro e como o split/repasse
   funciona. Projeto grande, fora do escopo de "cartões salvos".
3. **Adiar** — escolhido.

## Decisão

Adiar. Reavaliar se/quando o modelo de recebimento mudar (ex.: plataforma
passar a ser o collector) ou se houver demanda real por recompra com o mesmo
profissional.
