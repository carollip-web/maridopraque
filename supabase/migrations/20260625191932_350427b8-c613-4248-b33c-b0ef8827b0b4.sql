-- Permite que o profissional atualize (re-upload) seus próprios documentos no Storage.
-- Sem isto, o upsert: true no client falha com "new row violates row-level security policy"
-- sempre que o arquivo já existe (reenvio ou nova tentativa após erro).

DROP POLICY IF EXISTS "Profissional atualiza proprio doc" ON storage.objects;

CREATE POLICY "Profissional atualiza proprio doc"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos-profissionais'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'documentos-profissionais'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Também relaxa o INSERT removendo a exigência de existir um profissional_perfil prévio.
-- O usuário autenticado já cria/atualiza o perfil nas etapas anteriores, mas se algo falhar
-- ele pode chegar na etapa 4 sem a linha, o que dispararia o mesmo erro de RLS.

DROP POLICY IF EXISTS "Profissional upload proprio doc" ON storage.objects;

CREATE POLICY "Profissional upload proprio doc"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos-profissionais'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Mesma coisa para leitura (assim o getPublicUrl / signed url do próprio dono sempre funciona).

DROP POLICY IF EXISTS "Profissional ve proprio doc" ON storage.objects;

CREATE POLICY "Profissional ve proprio doc"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos-profissionais'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);