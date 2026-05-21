-- Adicionar colunas do BTG na tabela de repasses
ALTER TABLE public.repasses_profissionais
ADD COLUMN IF NOT EXISTS btg_contract_guid text;

ALTER TABLE public.repasses_profissionais
ADD COLUMN IF NOT EXISTS operation_needs_approval boolean DEFAULT false;

ALTER TABLE public.repasses_profissionais
ADD COLUMN IF NOT EXISTS btg_response jsonb;

-- Remover a constraint antiga se existir
ALTER TABLE public.repasses_profissionais
DROP CONSTRAINT IF EXISTS chk_repasses_profissionais_status;

-- Adicionar a constraint atualizada
ALTER TABLE public.repasses_profissionais
ADD CONSTRAINT chk_repasses_profissionais_status 
CHECK (status IN (
  'pendente', 
  'aprovado', 
  'processando', 
  'aguardando_aprovacao_btg', 
  'enviado', 
  'pago', 
  'falhou', 
  'erro', 
  'cancelado'
));
