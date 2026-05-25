CREATE OR REPLACE FUNCTION public.aceitar_proposta_cliente(_proposta_id uuid)
RETURNS TABLE(ok boolean, orcamento_id uuid, proposta_id uuid, agenda_reserva uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prop record;
  v_orc record;
  v_reserva_id uuid;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_dur int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_prop FROM public.propostas WHERE id = _proposta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  SELECT * INTO v_orc FROM public.orcamentos WHERE id = v_prop.orcamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado';
  END IF;

  IF v_orc.cliente_id <> v_uid THEN
    RAISE EXCEPTION 'Você não tem permissão para aprovar esta proposta';
  END IF;

  IF v_orc.status NOT IN ('customizado_pendente','enviado') THEN
    RAISE EXCEPTION 'Este orçamento não pode mais receber aprovações (status: %)', v_orc.status;
  END IF;

  -- Aceita esta proposta
  UPDATE public.propostas SET status = 'aceita', updated_at = now() WHERE id = _proposta_id;
  -- Recusa as demais
  UPDATE public.propostas
     SET status = 'recusada', updated_at = now()
   WHERE orcamento_id = v_prop.orcamento_id AND id <> _proposta_id;

  -- Atualiza orçamento
  UPDATE public.orcamentos
     SET profissional_id = v_prop.profissional_id,
         valor_servico = v_prop.valor_servico,
         valor = COALESCE(v_prop.valor_servico,0) + COALESCE(taxa_material,0),
         status = 'aprovado',
         data_aprovacao = now(),
         updated_at = now()
   WHERE id = v_prop.orcamento_id;

  -- Reserva temporária na agenda (se houver data preferida)
  IF v_orc.data_preferida IS NOT NULL THEN
    SELECT COALESCE(duracao_padrao_min, 60) INTO v_dur
      FROM public.profissional_perfil WHERE user_id = v_prop.profissional_id;
    v_inicio := (v_orc.data_preferida::timestamp + COALESCE(v_orc.horario_preferido, time '09:00')) AT TIME ZONE 'America/Sao_Paulo';
    v_fim := v_inicio + make_interval(mins => COALESCE(v_dur,60));

    INSERT INTO public.profissional_bloqueios_agenda
      (profissional_id, orcamento_id, inicio, fim, status, motivo, expires_at)
    VALUES
      (v_prop.profissional_id, v_prop.orcamento_id, v_inicio, v_fim, 'temporario',
       'Reserva aguardando pagamento', now() + interval '30 minutes')
    RETURNING id INTO v_reserva_id;
  END IF;

  RETURN QUERY SELECT true, v_prop.orcamento_id, _proposta_id, v_reserva_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceitar_proposta_cliente(uuid) TO authenticated;