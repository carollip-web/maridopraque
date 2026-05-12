DROP POLICY IF EXISTS "Cliente/profissional/admin atualizam" ON public.orcamentos;

CREATE POLICY "Cliente/profissional/admin atualizam"
ON public.orcamentos
FOR UPDATE
USING (
  auth.uid() = cliente_id
  OR auth.uid() = profissional_id
  OR has_role(auth.uid(), 'admin'::app_role)
);