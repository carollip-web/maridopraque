CREATE TABLE IF NOT EXISTS public.profissionais_pre_cadastro (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nome text NOT NULL,
    telefone text NOT NULL,
    cidade text NOT NULL,
    especialidade_principal text NOT NULL,
    status text NOT NULL DEFAULT 'novo',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.profissionais_pre_cadastro ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for the public landing page form)
CREATE POLICY "Allow public insert to profissionais_pre_cadastro" ON public.profissionais_pre_cadastro
    FOR INSERT
    WITH CHECK (true);

-- Allow admins to read all records
CREATE POLICY "Allow admin to view profissionais_pre_cadastro" ON public.profissionais_pre_cadastro
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- Allow admins to update records (change status)
CREATE POLICY "Allow admin to update profissionais_pre_cadastro" ON public.profissionais_pre_cadastro
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );
