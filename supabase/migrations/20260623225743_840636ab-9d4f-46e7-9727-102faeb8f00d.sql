UPDATE public.financeiro_config
SET taxa_gateway_percent = 4.98,
    taxa_gateway_fixa = 0,
    updated_at = now()
WHERE id = true
  AND COALESCE(taxa_gateway_percent, 0) = 0
  AND COALESCE(taxa_gateway_fixa, 0) = 0;

CREATE OR REPLACE FUNCTION public.criar_split_pagamento(_pagamento_id uuid)
RETURNS public.pagamento_splits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pag public.pagamentos%ROWTYPE;
  v_orc public.orcamentos%ROWTYPE;
  v_cfg public.financeiro_config%ROWTYPE;
  v_split public.pagamento_splits%ROWTYPE;
  v_taxa_plat numeric;
  v_taxa_gw numeric;
  v_liq numeric;
  v_prof uuid;
BEGIN
  SELECT * INTO v_pag FROM public.pagamentos WHERE id = _pagamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento % não encontrado', _pagamento_id;
  END IF;

  SELECT * INTO v_split FROM public.pagamento_splits WHERE pagamento_id = _pagamento_id;
  IF FOUND THEN
    RETURN v_split;
  END IF;

  SELECT * INTO v_orc FROM public.orcamentos WHERE id = v_pag.orcamento_id;
  v_prof := COALESCE(v_pag.profissional_id, v_orc.profissional_id);
  IF v_prof IS NULL THEN
    RAISE EXCEPTION 'Sem profissional definido para pagamento %', _pagamento_id;
  END IF;

  SELECT * INTO v_cfg FROM public.financeiro_config WHERE id = true;
  IF NOT FOUND THEN
    v_cfg.taxa_plataforma_percent := 15;
    v_cfg.taxa_gateway_percent := 4.98;
    v_cfg.taxa_gateway_fixa := 0;
    v_cfg.dias_liberacao := 1;
  END IF;

  v_taxa_plat := ROUND((COALESCE(v_pag.valor_total,0) * COALESCE(v_cfg.taxa_plataforma_percent, 15) / 100.0)::numeric, 2);
  v_taxa_gw := ROUND((COALESCE(v_pag.valor_total,0) * COALESCE(NULLIF(v_cfg.taxa_gateway_percent, 0), 4.98) / 100.0)::numeric, 2)
               + COALESCE(v_cfg.taxa_gateway_fixa, 0);
  v_liq := COALESCE(v_pag.valor_total,0) - v_taxa_plat - v_taxa_gw;

  INSERT INTO public.pagamento_splits (
    pagamento_id, orcamento_id, profissional_id, cliente_id,
    valor_total, taxa_plataforma, taxa_gateway, valor_profissional,
    status, gateway, gateway_payment_id
  ) VALUES (
    v_pag.id, v_pag.orcamento_id, v_prof, v_pag.cliente_id,
    COALESCE(v_pag.valor_total,0), v_taxa_plat, v_taxa_gw, v_liq,
    'aguardando_conclusao', v_pag.gateway, v_pag.gateway_payment_id
  )
  RETURNING * INTO v_split;

  RETURN v_split;
END;
$$;

WITH taxas_reais AS (
  SELECT
    ps.id,
    COALESCE(
      (
        SELECT ROUND(SUM(COALESCE((fee->>'amount')::numeric, 0))::numeric, 2)
        FROM jsonb_array_elements(COALESCE(p.metadata->'last_webhook_payload'->'fee_details', '[]'::jsonb)) fee
        WHERE fee->>'type' = 'mercadopago_fee'
      ),
      ROUND((COALESCE(ps.valor_total, p.valor_total, 0) * 4.98 / 100.0)::numeric, 2)
    ) AS taxa_gateway_corrigida
  FROM public.pagamento_splits ps
  JOIN public.pagamentos p ON p.id = ps.pagamento_id
  WHERE COALESCE(ps.taxa_gateway, 0) = 0
    AND COALESCE(ps.valor_total, p.valor_total, 0) > 0
    AND p.status IN ('paid', 'approved', 'pago')
)
UPDATE public.pagamento_splits ps
SET taxa_gateway = tr.taxa_gateway_corrigida,
    valor_profissional = ROUND((COALESCE(ps.valor_total, 0) - COALESCE(ps.taxa_plataforma, 0) - tr.taxa_gateway_corrigida)::numeric, 2),
    updated_at = now()
FROM taxas_reais tr
WHERE ps.id = tr.id;

UPDATE public.pagamento_splits ps
SET status = 'disponivel',
    disponivel_em = COALESCE(ps.disponivel_em, now()),
    updated_at = now()
FROM public.pagamentos p, public.orcamentos o
WHERE ps.pagamento_id = p.id
  AND ps.orcamento_id = o.id
  AND ps.status = 'aguardando_conclusao'
  AND o.status = 'concluido'
  AND (p.status IN ('paid', 'approved', 'pago') OR p.status_autorizacao = 'capturado');