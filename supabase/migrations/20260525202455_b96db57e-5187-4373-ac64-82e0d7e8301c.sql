CREATE OR REPLACE FUNCTION public.marcar_orcamento_enviado(_orcamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_updated_id uuid;
  v_status text;
  v_prof_id uuid;
BEGIN
  v_prof_id := auth.uid();

  SELECT EXISTS (
    SELECT 1 FROM public.propostas
    WHERE orcamento_id = _orcamento_id
    AND profissional_id = v_prof_id
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Você precisa enviar uma proposta primeiro.');
  END IF;

  UPDATE public.orcamentos
  SET status = 'enviado', updated_at = now()
  WHERE id = _orcamento_id
  AND status IN ('customizado_pendente', 'enviado')
  RETURNING id, status INTO v_updated_id, v_status;

  IF v_updated_id IS NULL THEN
    SELECT status INTO v_status FROM public.orcamentos WHERE id = _orcamento_id;
    RETURN jsonb_build_object('ok', false, 'error', 'Pedido em status "' || COALESCE(v_status, 'desconhecido') || '" não permite novas propostas.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_orcamento_enviado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_orcamento_enviado(uuid) TO authenticated;