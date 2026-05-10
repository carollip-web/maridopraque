DO $$ BEGIN
  CREATE TYPE public.admin_level AS ENUM ('super_admin','admin','financeiro','suporte');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS admin_level public.admin_level;