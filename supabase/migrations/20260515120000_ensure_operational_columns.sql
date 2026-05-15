-- Ensure all operational columns exist in profissional_perfil
ALTER TABLE public.profissional_perfil
ADD COLUMN IF NOT EXISTS anos_experiencia integer;

ALTER TABLE public.profissional_perfil
ADD COLUMN IF NOT EXISTS raio_atendimento_km integer;

ALTER TABLE public.profissional_perfil
ADD COLUMN IF NOT EXISTS chave_pix text;

ALTER TABLE public.profissional_perfil
ADD COLUMN IF NOT EXISTS atende_emergencias boolean DEFAULT false;

ALTER TABLE public.profissional_perfil
ADD COLUMN IF NOT EXISTS veiculo_proprio boolean DEFAULT false;

ALTER TABLE public.profissional_perfil
ADD COLUMN IF NOT EXISTS genero text;

ALTER TABLE public.profissional_perfil
ADD COLUMN IF NOT EXISTS oferece_apoio_feminino boolean NOT NULL DEFAULT false;

-- Notify PostgREST to reload schema
SELECT pg_notify('pgrst', 'reload schema');
