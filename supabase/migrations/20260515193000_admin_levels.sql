-- Migration: Multi-admin support with permission levels
-- Idempotent follow-up migration renamed from duplicated version 20260510.

ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS admin_level TEXT
  CHECK (admin_level IN ('super_admin', 'admin', 'financeiro', 'suporte'))
  DEFAULT NULL;

UPDATE public.user_roles
SET admin_level = 'super_admin'
WHERE role = 'admin' AND admin_level IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_admin_level ON public.user_roles(admin_level);

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND admin_level = 'super_admin'
  );
$$;
