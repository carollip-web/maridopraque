-- Update RLS policy to allow Apoio Feminino to accept vacancy
DROP POLICY IF EXISTS "Cliente/profissional/admin atualizam" ON public.orcamentos;

CREATE POLICY "Cliente/profissional/admin atualizam"
  ON public.orcamentos
  FOR UPDATE
  USING (
    auth.uid() = cliente_id
    OR auth.uid() = profissional_id
    OR auth.uid() = apoio_profissional_id
    OR public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'profissional') AND profissional_id IS NULL)
    OR (public.has_role(auth.uid(), 'profissional') AND tipo_atendimento = 'homem_com_apoio_feminino' AND apoio_profissional_id IS NULL)
  );
