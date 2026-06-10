
-- 1) Notificar profissional quando sua proposta for recusada
CREATE OR REPLACE FUNCTION public.notify_proposta_recusada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'recusada' THEN
    SELECT service_name INTO v_service FROM public.orcamentos WHERE id = NEW.orcamento_id;
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
    VALUES (
      NEW.profissional_id,
      'Proposta não selecionada',
      'O cliente escolheu outra proposta para "' || COALESCE(v_service, 'o serviço') || '". Continue de olho em novas oportunidades!',
      NEW.orcamento_id,
      '/profissional?tab=orcamentos'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_proposta_recusada ON public.propostas;
CREATE TRIGGER trg_notify_proposta_recusada
AFTER UPDATE ON public.propostas
FOR EACH ROW EXECUTE FUNCTION public.notify_proposta_recusada();

-- 2) Notificar profissional + cliente quando reserva de agenda expira ou é cancelada
CREATE OR REPLACE FUNCTION public.notify_bloqueio_agenda_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service text;
  v_cliente uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('cancelado','expirado')
     AND NEW.orcamento_id IS NOT NULL THEN
    SELECT service_name, cliente_id INTO v_service, v_cliente
      FROM public.orcamentos WHERE id = NEW.orcamento_id;

    -- Profissional
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
    VALUES (
      NEW.profissional_id,
      CASE WHEN NEW.status='expirado'
           THEN 'Reserva expirada — horário liberado'
           ELSE 'Reserva cancelada — horário liberado' END,
      CASE WHEN NEW.status='expirado'
           THEN 'O cliente não concluiu o pagamento de "' || COALESCE(v_service,'o serviço') || '". O horário voltou a ficar disponível na sua agenda.'
           ELSE 'A reserva de "' || COALESCE(v_service,'o serviço') || '" foi cancelada. O horário voltou a ficar disponível.' END,
      NEW.orcamento_id,
      '/profissional?tab=agenda'
    );

    -- Cliente (apenas se expirou por falta de pagamento)
    IF NEW.status='expirado' AND v_cliente IS NOT NULL THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
      VALUES (
        v_cliente,
        'Sua reserva expirou',
        'O pagamento de "' || COALESCE(v_service,'o serviço') || '" não foi concluído a tempo e a reserva foi liberada. Refaça o pedido se ainda desejar.',
        NEW.orcamento_id,
        '/cliente?tab=pedidos&pedidoId=' || NEW.orcamento_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bloqueio_agenda_status ON public.profissional_bloqueios_agenda;
CREATE TRIGGER trg_notify_bloqueio_agenda_status
AFTER UPDATE ON public.profissional_bloqueios_agenda
FOR EACH ROW EXECUTE FUNCTION public.notify_bloqueio_agenda_status();

-- 3) Ajustar limpar_reservas_temporarias_expiradas: marcar como 'expirado' (em vez de deletar)
-- para disparar a notificação acima, e também cancelar o orçamento se ainda estiver aprovado.
CREATE OR REPLACE FUNCTION public.limpar_reservas_temporarias_expiradas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  FOR v_row IN
    SELECT id, orcamento_id
      FROM public.profissional_bloqueios_agenda
     WHERE status = 'temporario'
       AND expires_at IS NOT NULL
       AND expires_at < now()
  LOOP
    UPDATE public.profissional_bloqueios_agenda
       SET status='expirado', updated_at=now()
     WHERE id = v_row.id;

    -- Devolve orçamento ao pool se ainda estava aprovado sem pagamento
    IF v_row.orcamento_id IS NOT NULL THEN
      UPDATE public.orcamentos
         SET status='customizado_pendente',
             profissional_id=NULL,
             data_aprovacao=NULL,
             updated_at=now()
       WHERE id = v_row.orcamento_id
         AND status='aprovado';
    END IF;
  END LOOP;
END;
$$;

-- 4) Garantir realtime nas tabelas relevantes (notificacoes já está)
ALTER PUBLICATION supabase_realtime ADD TABLE public.propostas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profissional_bloqueios_agenda;
