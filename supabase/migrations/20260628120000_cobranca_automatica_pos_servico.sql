-- Cobrança automática pós-serviço: lembra o cliente de pagar quando o pedido
-- fica em "aguardando_pagamento" (fluxo pós-serviço, sem garantia de caução).
-- A notificação inserida dispara e-mail + push pelo gatilho trg_notificacoes_email.

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS aguardando_pagamento_desde timestamptz,
  ADD COLUMN IF NOT EXISTS cobranca_lembretes_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cobranca_ultimo_lembrete_em timestamptz;

CREATE OR REPLACE FUNCTION public.enviar_lembretes_cobranca()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT o.id, o.cliente_id, o.service_name
    FROM public.orcamentos o
    WHERE o.status = 'aguardando_pagamento'
      AND o.cliente_id IS NOT NULL
      AND COALESCE(o.aguardando_pagamento_desde, o.updated_at) < now() - interval '24 hours'
      AND (o.cobranca_ultimo_lembrete_em IS NULL OR o.cobranca_ultimo_lembrete_em < now() - interval '48 hours')
      AND o.cobranca_lembretes_count < 3
  LOOP
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link, lida)
    VALUES (r.cliente_id, 'Pagamento pendente',
      'O serviço "' || COALESCE(r.service_name,'contratado') || '" foi concluído e está aguardando seu pagamento. Finalize para liberar o repasse ao profissional.',
      r.id, '/checkout?orcamentoId=' || r.id, false);
    UPDATE public.orcamentos
      SET cobranca_lembretes_count = cobranca_lembretes_count + 1,
          cobranca_ultimo_lembrete_em = now()
      WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;

-- Agenda a cada 6h (a cadência 24h/48h e o teto de 3 são controlados na função).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cobranca-lembretes';
SELECT cron.schedule('cobranca-lembretes', '0 */6 * * *', $$SELECT public.enviar_lembretes_cobranca();$$);

-- Visão para o admin: serviços concluídos aguardando pagamento.
-- security_invoker = true → respeita o RLS de quem consulta (admin vê tudo;
-- usuário comum não enxerga dados de terceiros).
CREATE OR REPLACE VIEW public.vw_cobrancas_pendentes
WITH (security_invoker = true) AS
SELECT o.id AS orcamento_id, o.cliente_id, c.nome AS cliente_nome, c.email AS cliente_email,
       o.profissional_id, p.nome AS profissional_nome,
       o.service_name, o.valor, o.aguardando_pagamento_desde,
       o.cobranca_lembretes_count, o.cobranca_ultimo_lembrete_em,
       EXTRACT(EPOCH FROM (now() - COALESCE(o.aguardando_pagamento_desde, o.updated_at))) / 86400.0 AS dias_esperando
FROM public.orcamentos o
LEFT JOIN public.profiles c ON c.id = o.cliente_id
LEFT JOIN public.profiles p ON p.id = o.profissional_id
WHERE o.status = 'aguardando_pagamento';
