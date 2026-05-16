-- Garantir que orcamento_materiais tenha uma FK para orcamentos
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'orcamento_materiais_orcamento_id_fkey'
    ) THEN
        ALTER TABLE public.orcamento_materiais
        ADD CONSTRAINT orcamento_materiais_orcamento_id_fkey
        FOREIGN KEY (orcamento_id)
        REFERENCES public.orcamentos(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Recarregar schema para o PostgREST perceber a nova relação
NOTIFY pgrst, 'reload schema';
