-- Tabela de Favoritos
CREATE TABLE IF NOT EXISTS public.cliente_favoritos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    profissional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, profissional_id)
);

-- Habilita RLS
ALTER TABLE public.cliente_favoritos ENABLE ROW LEVEL SECURITY;

-- Políticas para Favoritos
CREATE POLICY "Clientes podem ver seus próprios favoritos"
    ON public.cliente_favoritos FOR SELECT
    USING (auth.uid() = cliente_id);

CREATE POLICY "Clientes podem adicionar favoritos"
    ON public.cliente_favoritos FOR INSERT
    WITH CHECK (auth.uid() = cliente_id);

CREATE POLICY "Clientes podem remover seus favoritos"
    ON public.cliente_favoritos FOR DELETE
    USING (auth.uid() = cliente_id);


-- Tabela de Tickets de Suporte
CREATE TABLE IF NOT EXISTS public.suporte_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    assunto TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'resolvido')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita RLS
ALTER TABLE public.suporte_tickets ENABLE ROW LEVEL SECURITY;

-- Políticas para Suporte
CREATE POLICY "Usuários podem ver seus próprios tickets"
    ON public.suporte_tickets FOR SELECT
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Usuários podem criar tickets"
    ON public.suporte_tickets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins podem atualizar tickets"
    ON public.suporte_tickets FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- Caso falte a função update_modified_column, vamos garantir que ela exista
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at no suporte
DROP TRIGGER IF EXISTS update_suporte_tickets_updated_at ON public.suporte_tickets;
CREATE TRIGGER update_suporte_tickets_updated_at
    BEFORE UPDATE ON public.suporte_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
