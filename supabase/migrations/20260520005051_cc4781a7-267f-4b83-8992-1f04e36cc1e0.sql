-- 1. profissional_perfil: Mercado Pago + Pix fields
ALTER TABLE public.profissional_perfil
  ADD COLUMN IF NOT EXISTS mp_user_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_access_token TEXT,
  ADD COLUMN IF NOT EXISTS mp_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS mp_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mp_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pix_key_type TEXT,
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS pix_holder_name TEXT,
  ADD COLUMN IF NOT EXISTS pix_holder_document TEXT,
  ADD COLUMN IF NOT EXISTS pix_dados_confirmados BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS repasse_automatico BOOLEAN NOT NULL DEFAULT true;

-- 2. services_catalog: comissão marketplace
ALTER TABLE public.services_catalog
  ADD COLUMN IF NOT EXISTS comissao_marketplace_pct NUMERIC NOT NULL DEFAULT 15;

-- 3. repasses_profissionais
CREATE TABLE IF NOT EXISTS public.repasses_profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL,
  cliente_id UUID,
  orcamento_id UUID,
  pagamento_id UUID,
  valor_bruto NUMERIC NOT NULL DEFAULT 0,
  valor_comissao_marketplace NUMERIC NOT NULL DEFAULT 0,
  valor_liquido NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  erro TEXT,
  pix_key TEXT,
  pix_key_type TEXT,
  pix_holder_name TEXT,
  pix_holder_document TEXT,
  approved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repasses_status ON public.repasses_profissionais(status);
CREATE INDEX IF NOT EXISTS idx_repasses_profissional ON public.repasses_profissionais(profissional_id);
CREATE INDEX IF NOT EXISTS idx_repasses_pagamento ON public.repasses_profissionais(pagamento_id);

ALTER TABLE public.repasses_profissionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Financeiro gerencia repasses" ON public.repasses_profissionais;
CREATE POLICY "Financeiro gerencia repasses"
ON public.repasses_profissionais
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (role = 'admin' OR admin_level::text IN ('super_admin', 'financeiro'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (role = 'admin' OR admin_level::text IN ('super_admin', 'financeiro'))
  )
);

DROP POLICY IF EXISTS "Profissional ve proprios repasses" ON public.repasses_profissionais;
CREATE POLICY "Profissional ve proprios repasses"
ON public.repasses_profissionais
FOR SELECT
USING (auth.uid() = profissional_id);

CREATE TRIGGER repasses_updated_at
BEFORE UPDATE ON public.repasses_profissionais
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 4. RPC: criar_repasse_profissional_pendente
DROP FUNCTION IF EXISTS public.criar_repasse_profissional_pendente(uuid);
CREATE OR REPLACE FUNCTION public.criar_repasse_profissional_pendente(p_pagamento_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pag RECORD;
  v_orc RECORD;
  v_perfil RECORD;
  v_pct NUMERIC := 15;
  v_bruto NUMERIC := 0;
  v_comissao NUMERIC := 0;
  v_liquido NUMERIC := 0;
  v_repasse_id UUID;
  v_erro TEXT := NULL;
BEGIN
  SELECT * INTO v_pag FROM public.pagamentos WHERE id = p_pagamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento % não encontrado', p_pagamento_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.repasses_profissionais WHERE pagamento_id = p_pagamento_id) THEN
    SELECT id INTO v_repasse_id FROM public.repasses_profissionais WHERE pagamento_id = p_pagamento_id LIMIT 1;
    RETURN v_repasse_id;
  END IF;

  SELECT * INTO v_orc FROM public.orcamentos WHERE id = v_pag.orcamento_id;
  IF FOUND AND v_orc.service_id IS NOT NULL THEN
    SELECT COALESCE(comissao_marketplace_pct, 15) INTO v_pct
      FROM public.services_catalog WHERE id = v_orc.service_id;
  END IF;

  v_bruto := COALESCE(v_pag.valor_total, 0);
  v_comissao := ROUND((v_bruto * COALESCE(v_pct, 15) / 100.0)::numeric, 2);
  v_liquido := v_bruto - v_comissao;

  SELECT * INTO v_perfil FROM public.profissional_perfil
    WHERE user_id = v_pag.profissional_id;

  IF v_perfil.user_id IS NULL OR NOT COALESCE(v_perfil.pix_dados_confirmados, false) THEN
    v_erro := 'Profissional sem dados Pix confirmados';
  END IF;

  INSERT INTO public.repasses_profissionais (
    profissional_id, cliente_id, orcamento_id, pagamento_id,
    valor_bruto, valor_comissao_marketplace, valor_liquido,
    status, erro,
    pix_key, pix_key_type, pix_holder_name, pix_holder_document
  ) VALUES (
    v_pag.profissional_id, v_pag.cliente_id, v_pag.orcamento_id, v_pag.id,
    v_bruto, v_comissao, v_liquido,
    'pendente', v_erro,
    v_perfil.pix_key, v_perfil.pix_key_type, v_perfil.pix_holder_name, v_perfil.pix_holder_document
  )
  RETURNING id INTO v_repasse_id;

  RETURN v_repasse_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_repasse_profissional_pendente(UUID) FROM PUBLIC, anon, authenticated;