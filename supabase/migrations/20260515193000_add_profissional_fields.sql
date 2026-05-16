ALTER TABLE public.profissional_perfil
ADD COLUMN IF NOT EXISTS chave_pix text,
ADD COLUMN IF NOT EXISTS anos_experiencia integer,
ADD COLUMN IF NOT EXISTS raio_atendimento_km integer,
ADD COLUMN IF NOT EXISTS atende_emergencias boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS veiculo_proprio boolean DEFAULT false;
