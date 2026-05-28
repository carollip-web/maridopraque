-- Adiciona suporte a múltiplas profissionais (Apoio Feminino) no mesmo orçamento
ALTER TABLE public.orcamentos
ADD COLUMN IF NOT EXISTS apoio_profissional_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS valor_apoio_feminino NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status_apoio TEXT CHECK (status_apoio IN ('buscando', 'confirmado'));

-- Adiciona index para facilitar buscas no feed de vagas
CREATE INDEX IF NOT EXISTS idx_orcamentos_apoio_profissional_id ON public.orcamentos(apoio_profissional_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status_apoio ON public.orcamentos(status_apoio);

COMMENT ON COLUMN public.orcamentos.apoio_profissional_id IS 'ID da profissional de Apoio Feminino alocada para este orçamento (se aplicável)';
COMMENT ON COLUMN public.orcamentos.valor_apoio_feminino IS 'Taxa extra (ex: 30%) cobrada pelo serviço de Apoio Feminino';
COMMENT ON COLUMN public.orcamentos.status_apoio IS 'Status do match do apoio feminino (buscando = aguardando aceite, confirmado = fechado com a AF)';
