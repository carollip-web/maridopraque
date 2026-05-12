
-- 1. Profiles: restrict professionals to clients they have orcamentos with
DROP POLICY IF EXISTS "Profiles viewable by self or admin/professional" ON public.profiles;
CREATE POLICY "Profiles viewable by self or admin"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'profissional'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.orcamentos o
      WHERE o.cliente_id = profiles.id
        AND o.profissional_id = auth.uid()
    )
  )
);

-- 2. Indicacoes: drop public read, add SECURITY DEFINER validator
DROP POLICY IF EXISTS "Codigo publico para validar" ON public.indicacoes;

CREATE OR REPLACE FUNCTION public.validar_codigo_indicacao(_codigo text)
RETURNS TABLE(valido boolean, desconto_percent integer, owner_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true, i.desconto_percent, i.user_id
  FROM public.indicacoes i
  WHERE i.codigo = _codigo
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.validar_codigo_indicacao(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_codigo_indicacao(text) TO authenticated;

-- 3. profissional_bloqueios: restrict to authenticated
DROP POLICY IF EXISTS "Bloqueios leitura publica" ON public.profissional_bloqueios;
CREATE POLICY "Bloqueios leitura autenticados"
ON public.profissional_bloqueios FOR SELECT
TO authenticated
USING (true);

-- 4. avaliacoes: restrict to authenticated
DROP POLICY IF EXISTS "Avaliacoes leitura publica" ON public.avaliacoes;
CREATE POLICY "Avaliacoes leitura autenticados"
ON public.avaliacoes FOR SELECT
TO authenticated
USING (true);

-- 5. user_roles: only super_admin can manage admin role assignments
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND admin_level = 'super_admin'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

-- Backfill: any existing admin row with NULL admin_level becomes super_admin
UPDATE public.user_roles SET admin_level = 'super_admin'
WHERE role = 'admin' AND admin_level IS NULL;

-- Prevent future NULL admin_level for admin rows
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_admin_level_required;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_admin_level_required
  CHECK (role <> 'admin' OR admin_level IS NOT NULL);

-- Replace blanket admin-manage policy with super-admin gate for admin rows
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "Super admin manages admin roles"
ON public.user_roles FOR ALL
USING (
  public.is_super_admin(auth.uid())
  OR (role <> 'admin' AND public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (role <> 'admin' AND public.has_role(auth.uid(), 'admin'::app_role))
);

-- 6. Storage: drop broad public listing on orcamento-fotos
DROP POLICY IF EXISTS "Orcamento fotos public read" ON storage.objects;

-- 7. Lock down internal trigger functions from public API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_orcamento_total() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_orcamento_total_self() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_orcamento_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_orcamento_concluido() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_new_orcamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_nova_mensagem() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_panico() FROM PUBLIC, anon, authenticated;
