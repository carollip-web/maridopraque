-- Tabela de auditoria de ações administrativas sensíveis
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON public.admin_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON public.admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas super_admin pode ler (clientes nunca leem; escrita é via service role)
DROP POLICY IF EXISTS "Super admin reads audit log" ON public.admin_audit_log;
CREATE POLICY "Super admin reads audit log"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
