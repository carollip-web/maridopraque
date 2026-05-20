-- Migration: consolidar_repasses_profissionais
-- Timestamp: 20260520104600

-- 1. Garantir que as colunas e defaults existam na tabela public.repasses_profissionais
ALTER TABLE public.repasses_profissionais
ADD COLUMN IF NOT EXISTS proposta_id uuid,
ADD COLUMN IF NOT EXISTS valor_taxa_gateway numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS btg_transfer_id text,
ADD COLUMN IF NOT EXISTS btg_end_to_end_id text,
ADD COLUMN IF NOT EXISTS btg_request_payload jsonb,
ADD COLUMN IF NOT EXISTS btg_response_payload jsonb,
ADD COLUMN IF NOT EXISTS processing_at timestamptz,
ADD COLUMN IF NOT EXISTS requested_at timestamptz DEFAULT now();

-- 2. Padronizar RLS: Remover políticas existentes e criar exatamente as duas especificadas
DROP POLICY IF EXISTS "Profissionais podem ver seus repasses" ON public.repasses_profissionais;
DROP POLICY IF EXISTS "Admins podem ver todos os repasses" ON public.repasses_profissionais;
DROP POLICY IF EXISTS "Admins podem atualizar repasses" ON public.repasses_profissionais;
DROP POLICY IF EXISTS "Dono pode ver seus repasses" ON public.repasses_profissionais;
DROP POLICY IF EXISTS "Admin e financeiro possuem controle total de repasses" ON public.repasses_profissionais;

-- Criar a política de SELECT para o profissional (dono)
CREATE POLICY "Dono pode ver seus repasses"
ON public.repasses_profissionais
FOR SELECT
USING (profissional_id = auth.uid());

-- Criar a política de ALL para admin/financeiro usando a mesma checagem de pagamentos
CREATE POLICY "Admin e financeiro possuem controle total de repasses"
ON public.repasses_profissionais
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role::text IN ('admin', 'super_admin', 'financeiro')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role::text IN ('admin', 'super_admin', 'financeiro')
  )
);

-- 3. Atualizar a função SQL/RPC criar_repasse_profissional_pendente
CREATE OR REPLACE FUNCTION public.criar_repasse_profissional_pendente(p_pagamento_id uuid)
RETURNS public.repasses_profissionais
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagamento RECORD;
  v_orcamento RECORD;
  v_proposta_id uuid;
  v_profissional RECORD;
  v_comissao_pct numeric(5,2);
  v_valor_bruto numeric(10,2);
  v_valor_comissao numeric(10,2);
  v_valor_taxa numeric(10,2) := 0;
  v_valor_liquido numeric(10,2);
  v_erro text;
  v_repasse public.repasses_profissionais%ROWTYPE;
BEGIN
  -- Idempotência: verificar se já existe repasse para este pagamento
  SELECT * INTO v_repasse FROM public.repasses_profissionais WHERE pagamento_id = p_pagamento_id LIMIT 1;
  IF FOUND THEN
    RETURN v_repasse;
  END IF;

  -- Buscar o pagamento
  SELECT 
    id,
    orcamento_id,
    cliente_id,
    profissional_id,
    valor_total
  INTO v_pagamento
  FROM public.pagamentos
  WHERE id = p_pagamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento % não encontrado', p_pagamento_id;
  END IF;

  v_valor_bruto := COALESCE(v_pagamento.valor_total, 0)::numeric(10,2);

  -- Buscar o orçamento
  SELECT * INTO v_orcamento FROM public.orcamentos WHERE id = v_pagamento.orcamento_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento % não encontrado', v_pagamento.orcamento_id;
  END IF;

  -- Buscar a proposta aceita relacionada (se existir)
  IF v_pagamento.profissional_id IS NOT NULL THEN
    SELECT id INTO v_proposta_id
    FROM public.propostas
    WHERE orcamento_id = v_pagamento.orcamento_id
      AND profissional_id = v_pagamento.profissional_id
      AND status::text IN ('aceita', 'aceito', 'aprovada', 'aprovado', 'accepted')
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
  END IF;

  -- Buscar dados do profissional em profissional_perfil
  SELECT * INTO v_profissional 
  FROM public.profissional_perfil 
  WHERE user_id = COALESCE(v_pagamento.profissional_id, v_orcamento.profissional_id)
  LIMIT 1;

  IF NOT FOUND THEN
    v_erro := 'Profissional não encontrado em profissional_perfil';
  ELSIF NOT COALESCE(v_profissional.pix_dados_confirmados, false) THEN
    v_erro := 'Profissional sem dados Pix confirmados';
  END IF;

  -- Obter percentual de comissão de services_catalog
  IF v_orcamento.service_id IS NOT NULL THEN
    SELECT COALESCE(comissao_marketplace_pct, 15.00) INTO v_comissao_pct
    FROM public.services_catalog
    WHERE id = v_orcamento.service_id;
  END IF;

  IF v_comissao_pct IS NULL THEN
    v_comissao_pct := 15.00;
  END IF;

  -- Calcular comissões e taxas
  v_valor_comissao := round(v_valor_bruto * v_comissao_pct / 100.0, 2)::numeric(10,2);
  v_valor_taxa := 0; -- Placeholder
  v_valor_liquido := (v_valor_bruto - v_valor_comissao - v_valor_taxa)::numeric(10,2);

  IF v_valor_liquido < 0 THEN
    v_valor_liquido := 0;
  END IF;

  -- Inserir em repasses_profissionais
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

NOTIFY pgrst, 'reload schema';
