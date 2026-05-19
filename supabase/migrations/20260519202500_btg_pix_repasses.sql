-- Migration: 20260519202500_btg_pix_repasses.sql

-- PARTE 1 — Atualizar tabela profissional_perfil
ALTER TABLE public.profissional_perfil
ADD COLUMN IF NOT EXISTS pix_key_type text,
ADD COLUMN IF NOT EXISTS pix_key text,
ADD COLUMN IF NOT EXISTS pix_holder_name text,
ADD COLUMN IF NOT EXISTS pix_holder_document text,
ADD COLUMN IF NOT EXISTS pix_dados_confirmados boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS repasse_automatico boolean NOT NULL DEFAULT true;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_profissional_perfil_pix_key_type'
    ) THEN
        ALTER TABLE public.profissional_perfil
        ADD CONSTRAINT chk_profissional_perfil_pix_key_type
        CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random'));
    END IF;
END $$;

-- PARTE 2 — Criar tabela public.repasses_profissionais
CREATE TABLE IF NOT EXISTS public.repasses_profissionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  pagamento_id uuid,
  orcamento_id uuid,
  proposta_id uuid,

  profissional_id uuid NOT NULL,
  cliente_id uuid,

  valor_bruto numeric(10,2) NOT NULL DEFAULT 0,
  valor_comissao_marketplace numeric(10,2) NOT NULL DEFAULT 0,
  valor_taxa_gateway numeric(10,2) NOT NULL DEFAULT 0,
  valor_liquido numeric(10,2) NOT NULL DEFAULT 0,

  pix_key_type text,
  pix_key text,
  pix_holder_name text,
  pix_holder_document text,

  status text NOT NULL DEFAULT 'pendente',
  btg_transfer_id text,
  btg_end_to_end_id text,

  btg_request_payload jsonb,
  btg_response_payload jsonb,
  erro text,

  requested_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  processing_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_repasses_profissionais_status') THEN
        ALTER TABLE public.repasses_profissionais
        ADD CONSTRAINT chk_repasses_profissionais_status
        CHECK (status IN ('pendente', 'aprovado', 'processando', 'enviado', 'pago', 'falhou', 'cancelado'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_repasses_profissionais_pix_key_type') THEN
        ALTER TABLE public.repasses_profissionais
        ADD CONSTRAINT chk_repasses_profissionais_pix_key_type
        CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_repasses_profissionais_valor_liquido') THEN
        ALTER TABLE public.repasses_profissionais
        ADD CONSTRAINT chk_repasses_profissionais_valor_liquido
        CHECK (valor_liquido >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_repasses_profissionais_valor_bruto') THEN
        ALTER TABLE public.repasses_profissionais
        ADD CONSTRAINT chk_repasses_profissionais_valor_bruto
        CHECK (valor_bruto >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_repasses_profissionais_valor_comissao') THEN
        ALTER TABLE public.repasses_profissionais
        ADD CONSTRAINT chk_repasses_profissionais_valor_comissao
        CHECK (valor_comissao_marketplace >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_repasses_profissionais_valor_taxa') THEN
        ALTER TABLE public.repasses_profissionais
        ADD CONSTRAINT chk_repasses_profissionais_valor_taxa
        CHECK (valor_taxa_gateway >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_repasses_profissionais_profissional_id ON public.repasses_profissionais(profissional_id);
CREATE INDEX IF NOT EXISTS idx_repasses_profissionais_status ON public.repasses_profissionais(status);
CREATE INDEX IF NOT EXISTS idx_repasses_profissionais_pagamento_id ON public.repasses_profissionais(pagamento_id);
CREATE INDEX IF NOT EXISTS idx_repasses_profissionais_created_at ON public.repasses_profissionais(created_at DESC);

-- PARTE 3 — RLS
ALTER TABLE public.repasses_profissionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissionais podem ver seus repasses" ON public.repasses_profissionais;
CREATE POLICY "Profissionais podem ver seus repasses"
ON public.repasses_profissionais
FOR SELECT
USING (profissional_id = auth.uid());

DROP POLICY IF EXISTS "Admins podem ver todos os repasses" ON public.repasses_profissionais;
CREATE POLICY "Admins podem ver todos os repasses"
ON public.repasses_profissionais
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role::text IN ('admin', 'super_admin', 'financeiro')
  )
);

DROP POLICY IF EXISTS "Admins podem atualizar repasses" ON public.repasses_profissionais;
CREATE POLICY "Admins podem atualizar repasses"
ON public.repasses_profissionais
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role::text IN ('admin', 'super_admin', 'financeiro')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role::text IN ('admin', 'super_admin', 'financeiro')
  )
);

-- PARTE 4 — Trigger updated_at
DROP TRIGGER IF EXISTS repasses_profissionais_updated ON public.repasses_profissionais;
CREATE TRIGGER repasses_profissionais_updated
BEFORE UPDATE ON public.repasses_profissionais
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
