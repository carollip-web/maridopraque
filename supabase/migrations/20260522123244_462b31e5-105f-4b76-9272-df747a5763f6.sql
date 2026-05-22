CREATE TABLE public.marketplace_integracoes (
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
  CONSTRAINT marketplace_integracoes_provider_key UNIQUE (provider)
);

ALTER TABLE public.marketplace_integracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins elevados controlam integracoes"
ON public.marketplace_integracoes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ur.admin_level::text IN ('super_admin', 'financeiro')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ur.admin_level::text IN ('super_admin', 'financeiro')
  )
);

CREATE TRIGGER set_marketplace_integracoes_updated_at
BEFORE UPDATE ON public.marketplace_integracoes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();