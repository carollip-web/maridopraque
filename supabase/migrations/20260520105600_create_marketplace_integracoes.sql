-- Migration: 20260520105600_create_marketplace_integracoes.sql

-- 1. Criar a tabela public.marketplace_integracoes
CREATE TABLE IF NOT EXISTS public.marketplace_integracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  account_id text,
  company_id text,
  connected_at timestamptz,
  connected_by uuid REFERENCES auth.users(id),
  extra jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_marketplace_integracoes_provider UNIQUE(provider)
);

-- Habilitar RLS
ALTER TABLE public.marketplace_integracoes ENABLE ROW LEVEL SECURITY;

-- Remover políticas se existirem
DROP POLICY IF EXISTS "Super admins possuem controle total de integracoes" ON public.marketplace_integracoes;
DROP POLICY IF EXISTS "Admins elevados controlam integracoes" ON public.marketplace_integracoes;

-- Criar a política de ALL para admins com nível elevado (super_admin ou financeiro)
CREATE POLICY "Admins elevados controlam integracoes"
ON public.marketplace_integracoes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'::app_role
    AND admin_level::text IN ('super_admin', 'financeiro')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'::app_role
    AND admin_level::text IN ('super_admin', 'financeiro')
  )
);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS tr_marketplace_integracoes_updated_at ON public.marketplace_integracoes;
CREATE TRIGGER tr_marketplace_integracoes_updated_at
  BEFORE UPDATE ON public.marketplace_integracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Permissões básicas
GRANT ALL ON TABLE public.marketplace_integracoes TO postgres;
GRANT ALL ON TABLE public.marketplace_integracoes TO service_role;
