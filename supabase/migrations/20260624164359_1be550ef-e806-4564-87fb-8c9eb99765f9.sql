CREATE POLICY "Clientes veem profissionais com proposta em seu orcamento"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.propostas pr
    JOIN public.orcamentos o ON o.id = pr.orcamento_id
    WHERE pr.profissional_id = profiles.id
      AND o.cliente_id = auth.uid()
  )
);