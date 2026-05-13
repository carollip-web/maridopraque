-- Backfill seguro: admins existentes sem admin_level recebem 'super_admin' uma vez,
-- evitando travar o admin atual após o fail-closed em useAuth.
UPDATE public.user_roles
SET admin_level = 'super_admin'
WHERE role = 'admin'
  AND admin_level IS NULL;