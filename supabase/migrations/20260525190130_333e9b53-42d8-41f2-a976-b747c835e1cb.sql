-- ============================================
-- MIGRATION: Adicionar colunas BTG à tabela repasses_profissionais
-- Verificação de órfãos já feita — 0 órfãos encontrados
-- ============================================

-- 1) Coluna btg_transfer_id
ALTER TABLE public.repasses_profissionais
ADD COLUMN IF NOT EXISTS btg_transfer_id text;

-- 2) Coluna btg_contract_guid
ALTER TABLE public.repasses_profissionais
ADD COLUMN IF NOT EXISTS btg_contract_guid text;

-- 3) Coluna operation_needs_approval (boolean, NOT NULL, DEFAULT false)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'repasses_profissionais'
      AND column_name = 'operation_needs_approval'
  ) THEN
    ALTER TABLE public.repasses_profissionais
    ADD COLUMN operation_needs_approval boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 4) Coluna btg_response (jsonb)
ALTER TABLE public.repasses_profissionais
ADD COLUMN IF NOT EXISTS btg_response jsonb;

-- 5) Coluna processing_at (timestamptz)
ALTER TABLE public.repasses_profissionais
ADD COLUMN IF NOT EXISTS processing_at timestamp with time zone;

-- 6) Foreign Key orcamento_id → orcamentos(id) ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'repasses_profissionais'
      AND constraint_name = 'fk_repasses_orcamento'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.repasses_profissionais
    ADD CONSTRAINT fk_repasses_orcamento
    FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE SET NULL;
  END IF;
END $$;