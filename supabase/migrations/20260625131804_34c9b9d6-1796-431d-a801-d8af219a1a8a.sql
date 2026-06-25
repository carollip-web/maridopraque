
-- 1) Track when the professional resumed (came back to) the registration
ALTER TABLE public.profissional_perfil
  ADD COLUMN IF NOT EXISTS cadastro_retomado_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cadastro_retomadas_count integer NOT NULL DEFAULT 0;

-- 2) Admin storage policies on the professional documents bucket
DROP POLICY IF EXISTS "Admin ve docs profissionais" ON storage.objects;
CREATE POLICY "Admin ve docs profissionais"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documentos-profissionais'
    AND public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admin upload docs profissionais" ON storage.objects;
CREATE POLICY "Admin upload docs profissionais"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documentos-profissionais'
    AND public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admin atualiza docs profissionais" ON storage.objects;
CREATE POLICY "Admin atualiza docs profissionais"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documentos-profissionais'
    AND public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admin deleta docs profissionais" ON storage.objects;
CREATE POLICY "Admin deleta docs profissionais"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documentos-profissionais'
    AND public.has_role(auth.uid(), 'admin')
  );
