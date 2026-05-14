-- Add tipo_atendimento column to orcamentos
ALTER TABLE public.orcamentos 
ADD COLUMN IF NOT EXISTS tipo_atendimento text;

COMMENT ON COLUMN public.orcamentos.tipo_atendimento IS 'Preferência de atendimento: mulher, homem, homem_com_apoio_feminino';
