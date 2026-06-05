
-- 1. Drop public read policy on documentos-profissionais (sensitive ID docs)
DROP POLICY IF EXISTS "Docs profissionais public read" ON storage.objects;

-- 2. Drop avatar listing policy (public bucket: direct CDN URLs still work; listing is what's risky)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- 3. Recreate profissionais_publicos view with security_invoker so RLS of querying user applies
DROP VIEW IF EXISTS public.profissionais_publicos;
CREATE VIEW public.profissionais_publicos
WITH (security_invoker = true) AS
SELECT user_id, slug, bio, especialidades, foto_url, cidade, ativo, aprovacao_status,
       lat, lng, raio_atendimento_km, oferece_apoio_feminino, anos_experiencia,
       experiencia_anos, atende_emergencias, veiculo_proprio, duracao_padrao_min,
       genero, created_at
FROM public.profissional_perfil
WHERE ativo = true AND aprovacao_status = 'aprovado';

GRANT SELECT ON public.profissionais_publicos TO anon, authenticated;

-- 4. Tighten orcamentos UPDATE: remove broad "any profissional can update unassigned" clause.
-- Keep apoio_feminino claim flow as is (it's tied to a specific tipo_atendimento).
DROP POLICY IF EXISTS "Cliente/profissional/admin atualizam" ON public.orcamentos;
CREATE POLICY "Cliente/profissional/admin atualizam" ON public.orcamentos
FOR UPDATE TO public
USING (
  auth.uid() = cliente_id
  OR auth.uid() = profissional_id
  OR auth.uid() = apoio_profissional_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'profissional'::app_role) AND tipo_atendimento = 'homem_com_apoio_feminino' AND apoio_profissional_id IS NULL)
);

-- 5. Restrict sensitive pricing/margin columns on services_catalog.
-- Public/anon and authenticated users get only safe columns; admin code uses select("*") via authenticated
-- session — admin paths in this app are all server-side and can be migrated later, but to avoid breaking
-- the admin UI today we keep full SELECT for authenticated and only restrict anon.
REVOKE SELECT ON public.services_catalog FROM anon;
GRANT SELECT (
  id, nome, categoria, descricao, preco_fixo, is_fixed_price, ativo, created_at,
  preco_min, preco_max, slug, complexidade, apoio_feminino_valor,
  urgencia_noturno_factor, domingo_feriado_factor
) ON public.services_catalog TO anon;

-- 6. Revoke EXECUTE from anon on SECURITY DEFINER functions that require an authenticated caller.
REVOKE EXECUTE ON FUNCTION public.aceitar_proposta_cliente(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.marcar_orcamento_enviado(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.confirmar_convite(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.verificar_convite(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.aceitar_proposta_cliente(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_orcamento_enviado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_convite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_convite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
