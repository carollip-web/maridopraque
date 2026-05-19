-- PARTE 1 - Adicionar coluna de comissão na tabela services_catalog:

ALTER TABLE public.services_catalog 
ADD COLUMN IF NOT EXISTS comissao_marketplace_pct numeric(5,2) NOT NULL DEFAULT 15.00;

COMMENT ON COLUMN public.services_catalog.comissao_marketplace_pct IS 
'Percentual de comissão do marketplace cobrado sobre o valor do serviço (0-100)';

-- Para evitar erros se a restrição já existir, podemos dropá-la antes
ALTER TABLE public.services_catalog
DROP CONSTRAINT IF EXISTS services_catalog_comissao_range;

ALTER TABLE public.services_catalog 
ADD CONSTRAINT services_catalog_comissao_range 
CHECK (comissao_marketplace_pct >= 0 AND comissao_marketplace_pct <= 100);

-- PARTE 2 - Adicionar colunas de integração Mercado Pago na tabela profissional_perfil:

ALTER TABLE public.profissional_perfil
ADD COLUMN IF NOT EXISTS mp_user_id text,
ADD COLUMN IF NOT EXISTS mp_access_token text,
ADD COLUMN IF NOT EXISTS mp_refresh_token text,
ADD COLUMN IF NOT EXISTS mp_token_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS mp_connected_at timestamptz;

COMMENT ON COLUMN public.profissional_perfil.mp_user_id IS 
'ID do usuário no Mercado Pago (obtido após OAuth)';
COMMENT ON COLUMN public.profissional_perfil.mp_access_token IS 
'Access token OAuth do profissional no Mercado Pago (criptografado em rest)';

CREATE INDEX IF NOT EXISTS idx_profissional_perfil_mp_connected 
ON public.profissional_perfil(user_id) 
WHERE mp_user_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
