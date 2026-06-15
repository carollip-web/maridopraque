-- Restore SELECT on profissional_perfil to authenticated role.
-- RLS policies already restrict reads to admins and the row owner; the prior
-- column-level grants broke admin queries using select("*") and listed 0 rows.
GRANT SELECT ON public.profissional_perfil TO authenticated;
