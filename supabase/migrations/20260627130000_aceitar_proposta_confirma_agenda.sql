-- Flip pós-serviço: aceitar a proposta passa a CONFIRMAR a agenda direto.
-- Antes, o aceite criava um bloqueio "temporario" com expires_at de 30 min,
-- que era liberado se o pagamento não chegasse. No novo fluxo o pagamento
-- ocorre só após a conclusão do serviço, então o horário fica reservado de
-- forma definitiva já no aceite (status 'confirmado', sem expires_at).

-- Overload principal (com _data_agendada), usado pelo cliente no app.
CREATE OR REPLACE FUNCTION public.aceitar_proposta_cliente(_proposta_id uuid, _data_agendada timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(ok boolean, orcamento_id uuid, proposta_id uuid, agenda_reserva uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prop public.propostas%ROWTYPE;
  v_orc public.orcamentos%ROWTYPE;
  v_reserva_id uuid;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_dur int;
  v_data_final timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_prop FROM public.propostas p WHERE p.id = _proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;

  SELECT * INTO v_orc FROM public.orcamentos o WHERE o.id = v_prop.orcamento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;

  IF v_orc.cliente_id <> v_uid THEN
    RAISE EXCEPTION 'Você não tem permissão para aprovar esta proposta';
  END IF;

  IF v_orc.status::text NOT IN ('customizado_pendente','enviado') THEN
    RAISE EXCEPTION 'Este orçamento não pode mais receber aprovações (status: %)', v_orc.status;
  END IF;

  UPDATE public.propostas p SET status = 'aceita', updated_at = now() WHERE p.id = _proposta_id;
  UPDATE public.propostas p
     SET status = 'recusada', updated_at = now()
   WHERE p.orcamento_id = v_prop.orcamento_id AND p.id <> _proposta_id;

  -- Calcula data_agendada efetiva: usa o que veio do cliente; senão deriva de data_preferida + horario_preferido
  SELECT COALESCE(pp.duracao_padrao_min, 60) INTO v_dur
    FROM public.profissional_perfil pp WHERE pp.user_id = v_prop.profissional_id;

  IF _data_agendada IS NOT NULL THEN
    v_data_final := _data_agendada;
  ELSIF v_orc.data_preferida IS NOT NULL THEN
    v_data_final := (v_orc.data_preferida::timestamp + COALESCE(v_orc.horario_preferido, time '09:00')) AT TIME ZONE 'America/Sao_Paulo';
  ELSE
    v_data_final := NULL;
  END IF;

  PERFORM set_config('app.allow_orcamento_assignment','1', true);

  UPDATE public.orcamentos o
     SET profissional_id = v_prop.profissional_id,
         valor_servico = v_prop.valor_servico,
         valor = COALESCE(v_prop.valor_servico,0) + COALESCE(o.taxa_material,0),
         status = 'aprovado',
         data_agendada = COALESCE(v_data_final, o.data_agendada),
         data_aprovacao = now(),
         updated_at = now()
   WHERE o.id = v_prop.orcamento_id;

  IF v_data_final IS NOT NULL THEN
    v_inicio := v_data_final;
    v_fim := v_inicio + make_interval(mins => COALESCE(v_dur,60));

    INSERT INTO public.profissional_bloqueios_agenda
      (profissional_id, orcamento_id, inicio, fim, status, motivo, expires_at)
    VALUES
      (v_prop.profissional_id, v_prop.orcamento_id, v_inicio, v_fim, 'confirmado',
       'Serviço agendado', NULL)
    RETURNING id INTO v_reserva_id;
  END IF;

  ok := true;
  orcamento_id := v_prop.orcamento_id;
  proposta_id := _proposta_id;
  agenda_reserva := v_reserva_id;
  RETURN NEXT;
END;
$function$;

-- Overload legado (sem _data_agendada). Mantido em sincronia para o caso de
-- alguma chamada ainda usar a assinatura de 1 argumento.
CREATE OR REPLACE FUNCTION public.aceitar_proposta_cliente(_proposta_id uuid)
 RETURNS TABLE(ok boolean, orcamento_id uuid, proposta_id uuid, agenda_reserva uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prop public.propostas%ROWTYPE;
  v_orc public.orcamentos%ROWTYPE;
  v_reserva_id uuid;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_dur int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_prop FROM public.propostas p WHERE p.id = _proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;

  SELECT * INTO v_orc FROM public.orcamentos o WHERE o.id = v_prop.orcamento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;

  IF v_orc.cliente_id <> v_uid THEN
    RAISE EXCEPTION 'Você não tem permissão para aprovar esta proposta';
  END IF;

  IF v_orc.status::text NOT IN ('customizado_pendente','enviado') THEN
    RAISE EXCEPTION 'Este orçamento não pode mais receber aprovações (status: %)', v_orc.status;
  END IF;

  UPDATE public.propostas p SET status = 'aceita', updated_at = now() WHERE p.id = _proposta_id;
  UPDATE public.propostas p
     SET status = 'recusada', updated_at = now()
   WHERE p.orcamento_id = v_prop.orcamento_id AND p.id <> _proposta_id;

  PERFORM set_config('app.allow_orcamento_assignment','1', true);

  UPDATE public.orcamentos o
     SET profissional_id = v_prop.profissional_id,
         valor_servico = v_prop.valor_servico,
         valor = COALESCE(v_prop.valor_servico,0) + COALESCE(o.taxa_material,0),
         status = 'aprovado',
         data_aprovacao = now(),
         updated_at = now()
   WHERE o.id = v_prop.orcamento_id;

  IF v_orc.data_preferida IS NOT NULL THEN
    SELECT COALESCE(pp.duracao_padrao_min, 60) INTO v_dur
      FROM public.profissional_perfil pp WHERE pp.user_id = v_prop.profissional_id;
    v_inicio := (v_orc.data_preferida::timestamp + COALESCE(v_orc.horario_preferido, time '09:00')) AT TIME ZONE 'America/Sao_Paulo';
    v_fim := v_inicio + make_interval(mins => COALESCE(v_dur,60));

    INSERT INTO public.profissional_bloqueios_agenda
      (profissional_id, orcamento_id, inicio, fim, status, motivo, expires_at)
    VALUES
      (v_prop.profissional_id, v_prop.orcamento_id, v_inicio, v_fim, 'confirmado',
       'Serviço agendado', NULL)
    RETURNING id INTO v_reserva_id;
  END IF;

  ok := true;
  orcamento_id := v_prop.orcamento_id;
  proposta_id := _proposta_id;
  agenda_reserva := v_reserva_id;
  RETURN NEXT;
END;
$function$;
