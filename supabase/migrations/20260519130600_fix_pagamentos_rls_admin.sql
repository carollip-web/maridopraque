-- Corrigir política RLS de pagamentos para incluir super_admin e financeiro
DROP POLICY IF EXISTS "Admins podem ver todos os pagamentos" ON public.pagamentos;

CREATE POLICY "Admins podem ver todos os pagamentos"
  ON public.pagamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('admin', 'super_admin', 'financeiro')
    )
  );

NOTIFY pgrst, 'reload schema';
