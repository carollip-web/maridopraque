ALTER TABLE public.profissional_perfil
  ADD COLUMN IF NOT EXISTS termo_aceito_em timestamptz,
  ADD COLUMN IF NOT EXISTS termo_versao text,
  ADD COLUMN IF NOT EXISTS onboarding_completo boolean NOT NULL DEFAULT false;