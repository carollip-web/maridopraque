
-- 1) Restrict public read on profissional_disponibilidade to approved/active professionals only
DROP POLICY IF EXISTS "Disponibilidade leitura publica" ON public.profissional_disponibilidade;
CREATE POLICY "Disponibilidade leitura publica aprovados"
ON public.profissional_disponibilidade
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profissional_perfil pp
    WHERE pp.user_id = profissional_disponibilidade.user_id
      AND pp.aprovacao_status = 'aprovado'
      AND pp.ativo = true
  )
);

-- 2) Prevent professionals from self-assigning by revoking column-level UPDATE on assignment columns.
--    Assignment is performed via SECURITY DEFINER flows (e.g. aceitar_proposta_cliente) running as service_role/postgres.
REVOKE UPDATE (profissional_id) ON public.orcamentos FROM authenticated, anon;
REVOKE UPDATE (apoio_profissional_id) ON public.orcamentos FROM authenticated, anon;
