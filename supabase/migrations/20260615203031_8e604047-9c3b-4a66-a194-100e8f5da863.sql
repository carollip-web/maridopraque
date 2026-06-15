
-- ============================================================
-- 1) Endereço do cliente: garantir que endereco_snapshot só
--    exista DEPOIS de o orçamento ter profissional atribuído.
--    Antes da atribuição, é apagado por trigger.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_endereco_snapshot_only_when_assigned()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.profissional_id IS NULL THEN
    NEW.endereco_snapshot := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_endereco_snapshot_only_when_assigned ON public.orcamentos;
CREATE TRIGGER trg_endereco_snapshot_only_when_assigned
  BEFORE INSERT OR UPDATE ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_endereco_snapshot_only_when_assigned();

-- Limpa snapshots em pedidos ainda não atribuídos
UPDATE public.orcamentos
   SET endereco_snapshot = NULL
 WHERE profissional_id IS NULL
   AND endereco_snapshot IS NOT NULL;

-- ============================================================
-- 2) profissional_perfil: limita visualização ampla de PII
--    apenas a admins com admin_level super_admin/admin
--    (financeiro/suporte não veem CPF, endereço, etc.)
-- ============================================================
DROP POLICY IF EXISTS "Admin ve dados validacao" ON public.profissional_perfil;
CREATE POLICY "Admin ve dados validacao"
ON public.profissional_perfil
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::app_role
      AND ur.admin_level::text IN ('super_admin','admin')
  )
);

-- ============================================================
-- 3) avaliacoes: remove exposição pública de cliente_id e
--    orcamento_id. Públicos só veem nota/comentário/profissional.
-- ============================================================
REVOKE SELECT (cliente_id, orcamento_id) ON public.avaliacoes FROM anon;

-- ============================================================
-- 4) SECURITY DEFINER: revoga EXECUTE de anon nas 5 funções
--    flagueadas. Anon não tem auth.uid() válido para usá-las.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.aceitar_proposta_cliente(uuid, timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_permissions(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_section_allowed(text, boolean, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
