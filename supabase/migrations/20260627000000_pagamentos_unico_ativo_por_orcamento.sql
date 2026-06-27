-- Fase 1 — Pagamento à prova de bala
-- Impede 2 pagamentos ATIVOS (status 'pending' ou 'paid') para o mesmo
-- orçamento, evitando cobrança dupla em duplo-clique / corrida de webhook.

-- 1. Limpeza defensiva: se já existirem múltiplos pagamentos ativos para o
--    mesmo orçamento, mantém apenas o "melhor" (paid tem prioridade sobre
--    pending; em empate, o mais recente) e cancela os demais. Sem isso, a
--    criação do índice único abaixo falharia em bancos com dados legados.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY orcamento_id
      ORDER BY (status = 'paid') DESC, created_at DESC
    ) AS rn
  FROM public.pagamentos
  WHERE status IN ('pending', 'paid')
)
UPDATE public.pagamentos p
SET status = 'canceled'
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- 2. Índice único parcial: no máximo 1 pagamento ativo por orçamento.
CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_orcamento_ativo_uidx
  ON public.pagamentos (orcamento_id)
  WHERE status IN ('pending', 'paid');
