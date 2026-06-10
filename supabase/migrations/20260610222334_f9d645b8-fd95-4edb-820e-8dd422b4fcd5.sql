ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamento_splits;
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;
ALTER TABLE public.pagamento_splits REPLICA IDENTITY FULL;

-- Função para resolução manual de disputa pelo admin
CREATE OR REPLACE FUNCTION public.resolver_disputa_orcamento(
  _orcamento_id uuid,
  _pct_prestador numeric,
  _pct_plataforma numeric,
  _motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_orc public.orcamentos%ROWTYPE;
  v_pag public.pagamentos%ROWTYPE;
  v_split public.pagamento_splits%ROWTYPE;
  v_valor_total numeric;
  v_valor_prof numeric;
  v_valor_plat numeric;
  v_valor_reemb numeric;
  v_pct_reemb numeric;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.user_roles
                 WHERE user_id = v_uid AND role = 'admin'
                   AND (admin_level)::text IN ('super_admin','admin','financeiro'))
    INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas admin pode resolver disputas';
  END IF;
  IF _pct_prestador < 0 OR _pct_plataforma < 0 OR (_pct_prestador + _pct_plataforma) > 100 THEN
    RAISE EXCEPTION 'Percentuais inválidos';
  END IF;

  SELECT * INTO v_orc FROM public.orcamentos WHERE id = _orcamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;

  SELECT * INTO v_pag FROM public.pagamentos
    WHERE orcamento_id = _orcamento_id AND status = 'paid'
    ORDER BY paid_at DESC NULLS LAST LIMIT 1;
  SELECT * INTO v_split FROM public.pagamento_splits
    WHERE orcamento_id = _orcamento_id ORDER BY created_at DESC LIMIT 1;

  v_pct_reemb := 100 - _pct_prestador - _pct_plataforma;

  IF v_pag.id IS NOT NULL AND v_split.id IS NOT NULL THEN
    v_valor_total := COALESCE(v_pag.valor_total, 0);
    v_valor_prof := ROUND((v_valor_total * _pct_prestador / 100.0)::numeric, 2);
    v_valor_plat := ROUND((v_valor_total * _pct_plataforma / 100.0)::numeric, 2);
    v_valor_reemb := v_valor_total - v_valor_prof - v_valor_plat;

    UPDATE public.pagamento_splits
       SET valor_profissional = v_valor_prof,
           taxa_plataforma = v_valor_plat,
           valor_reembolso = v_valor_reemb,
           status = CASE WHEN v_valor_prof > 0 THEN 'disponivel' ELSE 'retido' END,
           disponivel_em = CASE WHEN v_valor_prof > 0 THEN now() ELSE disponivel_em END,
           motivo_cancelamento = 'disputa_admin: ' || COALESCE(_motivo, ''),
           updated_at = now()
     WHERE id = v_split.id;
  END IF;

  UPDATE public.orcamentos
     SET status = CASE WHEN _pct_prestador >= 100 THEN 'concluido' ELSE 'cancelado' END,
         observacoes_profissional = COALESCE(_motivo, observacoes_profissional),
         updated_at = now()
   WHERE id = _orcamento_id;

  UPDATE public.profissional_bloqueios_agenda
     SET status='cancelado', expires_at=now(), updated_at=now()
   WHERE orcamento_id=_orcamento_id AND status IN ('temporario','confirmado');

  INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
  VALUES (
    v_orc.cliente_id,
    'Disputa resolvida pelo admin',
    'Sua disputa foi analisada. Reembolso: ' || v_pct_reemb || '%.',
    _orcamento_id,
    '/cliente?tab=pedidos&pedidoId=' || _orcamento_id
  );

  IF v_orc.profissional_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
    VALUES (
      v_orc.profissional_id,
      'Disputa resolvida pelo admin',
      'A disputa foi analisada. Repasse ao profissional: ' || _pct_prestador || '%.',
      _orcamento_id,
      '/profissional?tab=servicos&orcamentoId=' || _orcamento_id
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pct_prestador', _pct_prestador,
    'pct_plataforma', _pct_plataforma,
    'pct_reembolso', v_pct_reemb,
    'valor_reembolso', COALESCE(v_valor_reemb, 0)
  );
END;
$$;