-- Fase 4 — Pagamento pós-serviço
-- Novo status: o serviço foi concluído pelo profissional e aguarda o pagamento
-- do cliente (pix/boleto/cartão via checkout). Transição: aprovado ->
-- aguardando_pagamento -> pago -> concluido.

ALTER TYPE public.orcamento_status ADD VALUE IF NOT EXISTS 'aguardando_pagamento';
