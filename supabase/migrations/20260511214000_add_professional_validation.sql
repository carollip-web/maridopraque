-- Professional validation fields
ALTER TABLE public.profissional_perfil
  ADD COLUMN IF NOT EXISTS aprovacao_status text NOT NULL DEFAULT 'pendente'
    CHECK (aprovacao_status IN ('pendente', 'em_analise', 'aprovado', 'rejeitado')),
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS foto_documento_frente text,
  ADD COLUMN IF NOT EXISTS foto_documento_verso text,
  ADD COLUMN IF NOT EXISTS foto_selfie text,
  ADD COLUMN IF NOT EXISTS experiencia_anos integer,
  ADD COLUMN IF NOT EXISTS como_conheceu text,
  ADD COLUMN IF NOT EXISTS observacoes_cadastro text,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS cadastro_completo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cadastro_submetido_em timestamptz;

-- Admin can see all validation data
CREATE POLICY IF NOT EXISTS "Admin ve dados validacao" ON public.profissional_perfil
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for professional documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-profissionais',
  'documentos-profissionais',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY IF NOT EXISTS "Profissional upload proprio doc"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documentos-profissionais' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Profissional ve proprio doc"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documentos-profissionais' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Admin ve todos docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documentos-profissionais' AND has_role(auth.uid(), 'admin'::app_role));
