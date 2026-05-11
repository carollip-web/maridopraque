ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS resposta_profissional text,
  ADD COLUMN IF NOT EXISTS resposta_em timestamptz;

CREATE POLICY "Profissional responde avaliacao recebida"
ON public.avaliacoes
FOR UPDATE
TO authenticated
USING (auth.uid() = profissional_id)
WITH CHECK (auth.uid() = profissional_id);