-- Evolution of scheduling system
-- Phase 1: Database Schema

-- Add columns to orcamentos for scheduling preferences
ALTER TABLE public.orcamentos 
ADD COLUMN IF NOT EXISTS data_preferida date,
ADD COLUMN IF NOT EXISTS periodo_preferido text, -- 'manha', 'tarde', 'noite', 'horario_especifico'
ADD COLUMN IF NOT EXISTS horario_preferido time,
ADD COLUMN IF NOT EXISTS flexibilidade_agenda text DEFAULT 'flexivel'; -- 'flexivel', 'exato'

COMMENT ON COLUMN public.orcamentos.periodo_preferido IS 'Preferência de período: manha, tarde, noite, horario_especifico';
COMMENT ON COLUMN public.orcamentos.flexibilidade_agenda IS 'Flexibilidade: flexivel, exato';

-- Update profissional_disponibilidade
ALTER TABLE public.profissional_disponibilidade
ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS recorrente boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS data_especifica date;

-- Update profissional_bloqueios
ALTER TABLE public.profissional_bloqueios
ADD COLUMN IF NOT EXISTS orcamento_id uuid REFERENCES public.orcamentos(id);

-- Ensure RLS is correct (re-asserting policies if needed)
DO $$ 
BEGIN
    -- Fix for profissional_disponibilidade
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin gerencia disponibilidade') THEN
        CREATE POLICY "Admin gerencia disponibilidade" ON public.profissional_disponibilidade FOR ALL TO authenticated USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin'))
        );
    END IF;

    -- Fix for profissional_bloqueios
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin gerencia bloqueios') THEN
        CREATE POLICY "Admin gerencia bloqueios" ON public.profissional_bloqueios FOR ALL TO authenticated USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin'))
        );
    END IF;
END $$;
