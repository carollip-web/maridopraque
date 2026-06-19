alter table public.pagamentos 
add column mp_customer_id text,
add column mp_card_id text,
add column status_autorizacao text check (status_autorizacao in (
  'pendente', 'autorizado', 'capturado', 
  'expirado', 'recobranca_pendente', 'falhou'
)) default 'pendente',
add column autorizacao_expira_em timestamptz,
add column tentativas_cobranca integer default 0,
add column ultima_tentativa_em timestamptz,
add column confirmacao_profissional_em timestamptz,
add column confirmacao_cliente_em timestamptz,
add column capturado_em timestamptz;

create index idx_pagamentos_cron_verificacao
on public.pagamentos (status_autorizacao, autorizacao_expira_em);
