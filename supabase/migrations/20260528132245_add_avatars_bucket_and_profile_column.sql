-- Adiciona a coluna avatar_url na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Cria o bucket 'avatars' para armazenar as fotos de perfil
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
) ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de RLS para o bucket avatars
-- Qualquer pessoa pode ver as fotos de perfil
CREATE POLICY "Avatar images are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

-- Apenas o próprio usuário pode fazer upload da sua foto
CREATE POLICY "Users can upload their own avatars"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Apenas o próprio usuário pode atualizar sua foto
CREATE POLICY "Users can update their own avatars"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Apenas o próprio usuário pode deletar sua foto
CREATE POLICY "Users can delete their own avatars"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );
