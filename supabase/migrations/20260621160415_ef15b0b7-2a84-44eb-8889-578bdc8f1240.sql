ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS status_autorizacao text,
  ADD COLUMN IF NOT EXISTS confirmacao_cliente_em timestamptz,
  ADD COLUMN IF NOT EXISTS confirmacao_profissional_em timestamptz,
  ADD COLUMN IF NOT EXISTS capturado_em timestamptz,
  ADD COLUMN IF NOT EXISTS autorizacao_expira_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_pagamentos_status_autorizacao
  ON public.pagamentos (status_autorizacao);