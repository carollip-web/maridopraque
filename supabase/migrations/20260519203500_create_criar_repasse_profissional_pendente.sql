-- Migration: 20260519203500_create_criar_repasse_profissional_pendente.sql

CREATE OR REPLACE FUNCTION public.criar_repasse_profissional_pendente(p_pagamento_id uuid)
RETURNS public.repasses_profissionais
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagamento public.pagamentos%ROWTYPE;
  v_orcamento public.orcamentos%ROWTYPE;
  v_proposta_id uuid;
  v_profissional public.profissional_perfil%ROWTYPE;
  v_comissao_pct numeric(5,2);
  v_valor_bruto numeric(10,2);
  v_valor_comissao numeric(10,2);
  v_valor_taxa numeric(10,2) := 0;
  v_valor_liquido numeric(10,2);
  v_erro text;
  v_repasse public.repasses_profissionais%ROWTYPE;
BEGIN
  -- 1. Idempotência: verificar se já existe repasse para este pagamento
  SELECT * INTO v_repasse FROM public.repasses_profissionais WHERE pagamento_id = p_pagamento_id LIMIT 1;
  IF FOUND THEN
    RETURN v_repasse;
  END IF;

  -- 2. Buscar pagamento
  SELECT * INTO v_pagamento FROM public.pagamentos WHERE id = p_pagamento_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento % não encontrado', p_pagamento_id;
  END IF;

  v_valor_bruto := COALESCE(v_pagamento.valor_total, 0)::numeric(10,2);

  -- 3. Buscar orçamento
  SELECT * INTO v_orcamento FROM public.orcamentos WHERE id = v_pagamento.orcamento_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento % não encontrado', v_pagamento.orcamento_id;
  END IF;

  -- 4. Buscar proposta aceita (se houver profissional_id e orcamento_id)
  IF v_pagamento.profissional_id IS NOT NULL THEN
    SELECT id INTO v_proposta_id 
    FROM public.propostas 
    WHERE orcamento_id = v_pagamento.orcamento_id 
      AND profissional_id = v_pagamento.profissional_id 
      AND status = 'aceita'
    LIMIT 1;
  END IF;

  -- 5. Buscar profissional em profissional_perfil
  SELECT * INTO v_profissional 
  FROM public.profissional_perfil 
  WHERE user_id = COALESCE(v_pagamento.profissional_id, v_orcamento.profissional_id)
  LIMIT 1;

  IF NOT FOUND THEN
    v_erro := 'Profissional não encontrado em profissional_perfil';
  ELSIF NOT COALESCE(v_profissional.pix_dados_confirmados, false) THEN
    v_erro := 'Profissional sem dados Pix confirmados';
  END IF;

  -- 6. Calcular taxas e comissões
  IF v_orcamento.service_id IS NOT NULL THEN
    SELECT COALESCE(comissao_marketplace_pct, 15.00) INTO v_comissao_pct
    FROM public.services_catalog
    WHERE id = v_orcamento.service_id;
  END IF;

  IF v_comissao_pct IS NULL THEN
    v_comissao_pct := 15.00;
  END IF;

  -- Calcular comissão do marketplace
  v_valor_comissao := (v_valor_bruto * v_comissao_pct / 100.0)::numeric(10,2);

  -- Taxa de gateway
  v_valor_taxa := 0;

  v_valor_liquido := (v_valor_bruto - v_valor_comissao - v_valor_taxa)::numeric(10,2);
  IF v_valor_liquido < 0 THEN
    v_valor_liquido := 0;
  END IF;

  -- 7. Inserir em repasses_profissionais
  INSERT INTO public.repasses_profissionais (
    pagamento_id,
    orcamento_id,
    proposta_id,
    profissional_id,
    cliente_id,
    valor_bruto,
    valor_comissao_marketplace,
    valor_taxa_gateway,
    valor_liquido,
    pix_key_type,
    pix_key,
    pix_holder_name,
    pix_holder_document,
    status,
    erro
  ) VALUES (
    v_pagamento.id,
    v_pagamento.orcamento_id,
    v_proposta_id,
    COALESCE(v_pagamento.profissional_id, v_orcamento.profissional_id),
    v_pagamento.cliente_id,
    v_valor_bruto,
    v_valor_comissao,
    v_valor_taxa,
    v_valor_liquido,
    v_profissional.pix_key_type,
    v_profissional.pix_key,
    v_profissional.pix_holder_name,
    v_profissional.pix_holder_document,
    'pendente',
    v_erro
  )
  RETURNING * INTO v_repasse;

  RETURN v_repasse;
END;
$$;

-- Permissões de Segurança
REVOKE EXECUTE ON FUNCTION public.criar_repasse_profissional_pendente(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.criar_repasse_profissional_pendente(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.criar_repasse_profissional_pendente(uuid) FROM authenticated;
