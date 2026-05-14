
-- RPC para garantir atualização de status pós-proposta ignorando RLS restritiva de update direto
CREATE OR REPLACE FUNCTION public.marcar_orcamento_enviado(_orcamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS to allow status update if logic matches
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_updated_id uuid;
  v_status text;
BEGIN
  -- 1. Valida que o usuário autenticado enviou uma proposta para este orçamento
  SELECT EXISTS (
    SELECT 1 FROM public.propostas 
    WHERE orcamento_id = _orcamento_id 
    AND profissional_id = auth.uid()
    AND status = 'pendente'
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Proposta pendente não encontrada para este profissional.');
  END IF;

  -- 2. Atualiza o status do orçamento para 'enviado'
  -- Apenas se estiver em um estado que permita receber propostas
  UPDATE public.orcamentos
  SET status = 'enviado', updated_at = now()
  WHERE id = _orcamento_id
  AND status IN ('customizado_pendente', 'enviado')
  RETURNING id, status INTO v_updated_id, v_status;

  IF v_updated_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pedido não encontrado ou status atual não permite transição para enviado.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

-- Permissões
REVOKE ALL ON FUNCTION public.marcar_orcamento_enviado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_orcamento_enviado(uuid) TO authenticated;
