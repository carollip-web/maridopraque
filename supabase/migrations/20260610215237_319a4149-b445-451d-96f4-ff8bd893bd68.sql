
CREATE OR REPLACE FUNCTION public.trg_orcamento_sync_agenda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dur int;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_existing uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Pagamento confirmado: confirma reserva
  IF NEW.status::text = 'pago'
     AND OLD.status::text IS DISTINCT FROM NEW.status::text
     AND NEW.profissional_id IS NOT NULL THEN

    SELECT id INTO v_existing
      FROM public.profissional_bloqueios_agenda
     WHERE orcamento_id = NEW.id
       AND profissional_id = NEW.profissional_id
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE public.profissional_bloqueios_agenda
         SET status = 'confirmado',
             expires_at = NULL,
             motivo = COALESCE(motivo, 'Serviço pago e agendado'),
             updated_at = now()
       WHERE id = v_existing;
    ELSIF NEW.data_preferida IS NOT NULL THEN
      SELECT COALESCE(pp.duracao_padrao_min, 60) INTO v_dur
        FROM public.profissional_perfil pp
       WHERE pp.user_id = NEW.profissional_id;

      v_inicio := (NEW.data_preferida::timestamp
                   + COALESCE(NEW.horario_preferido, time '09:00'))
                  AT TIME ZONE 'America/Sao_Paulo';
      v_fim := v_inicio + make_interval(mins => COALESCE(v_dur, 60));

      INSERT INTO public.profissional_bloqueios_agenda
        (profissional_id, orcamento_id, inicio, fim, status, motivo, expires_at)
      VALUES
        (NEW.profissional_id, NEW.id, v_inicio, v_fim,
         'confirmado', 'Serviço pago e agendado', NULL);
    END IF;
  END IF;

  -- Cancelamento: libera o horário
  IF NEW.status::text = 'cancelado'
     AND OLD.status::text IS DISTINCT FROM NEW.status::text THEN
    UPDATE public.profissional_bloqueios_agenda
       SET status = 'cancelado',
           expires_at = now(),
           updated_at = now()
     WHERE orcamento_id = NEW.id
       AND status IN ('temporario', 'confirmado');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orcamento_sync_agenda ON public.orcamentos;
CREATE TRIGGER trg_orcamento_sync_agenda
AFTER UPDATE ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_orcamento_sync_agenda();
