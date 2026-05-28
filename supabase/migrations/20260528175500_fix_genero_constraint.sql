ALTER TABLE public.profissional_perfil DROP CONSTRAINT IF EXISTS profissional_perfil_genero_check;

ALTER TABLE public.profissional_perfil 
ADD CONSTRAINT profissional_perfil_genero_check 
CHECK (genero IS NULL OR genero IN ('homem', 'mulher', 'outro', 'nao_informar', 'apoio_feminino'));
