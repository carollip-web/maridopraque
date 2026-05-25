-- 1) cliente_favoritos
CREATE TABLE IF NOT EXISTS public.cliente_favoritos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  profissional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_id, profissional_id)
);
ALTER TABLE public.cliente_favoritos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clientes podem ver seus próprios favoritos" ON public.cliente_favoritos;
CREATE POLICY "Clientes podem ver seus próprios favoritos"
  ON public.cliente_favoritos FOR SELECT USING (auth.uid() = cliente_id);
DROP POLICY IF EXISTS "Clientes podem adicionar favoritos" ON public.cliente_favoritos;
CREATE POLICY "Clientes podem adicionar favoritos"
  ON public.cliente_favoritos FOR INSERT WITH CHECK (auth.uid() = cliente_id);
DROP POLICY IF EXISTS "Clientes podem remover seus favoritos" ON public.cliente_favoritos;
CREATE POLICY "Clientes podem remover seus favoritos"
  ON public.cliente_favoritos FOR DELETE USING (auth.uid() = cliente_id);

-- 2) suporte_tickets
CREATE TABLE IF NOT EXISTS public.suporte_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','resolvido')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.suporte_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios tickets" ON public.suporte_tickets;
CREATE POLICY "Usuários podem ver seus próprios tickets"
  ON public.suporte_tickets FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));
DROP POLICY IF EXISTS "Usuários podem criar tickets" ON public.suporte_tickets;
CREATE POLICY "Usuários podem criar tickets"
  ON public.suporte_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins podem atualizar tickets" ON public.suporte_tickets;
CREATE POLICY "Admins podem atualizar tickets"
  ON public.suporte_tickets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));
DROP TRIGGER IF EXISTS trg_suporte_tickets_updated_at ON public.suporte_tickets;
CREATE TRIGGER trg_suporte_tickets_updated_at
  BEFORE UPDATE ON public.suporte_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) profissionais_pre_cadastro
CREATE TABLE IF NOT EXISTS public.profissionais_pre_cadastro (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  telefone text NOT NULL,
  cidade text NOT NULL,
  especialidade_principal text NOT NULL,
  status text NOT NULL DEFAULT 'novo',
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.profissionais_pre_cadastro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert to profissionais_pre_cadastro" ON public.profissionais_pre_cadastro;
CREATE POLICY "Allow public insert to profissionais_pre_cadastro"
  ON public.profissionais_pre_cadastro FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow admin to view profissionais_pre_cadastro" ON public.profissionais_pre_cadastro;
CREATE POLICY "Allow admin to view profissionais_pre_cadastro"
  ON public.profissionais_pre_cadastro FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
DROP POLICY IF EXISTS "Allow admin to update profissionais_pre_cadastro" ON public.profissionais_pre_cadastro;
CREATE POLICY "Allow admin to update profissionais_pre_cadastro"
  ON public.profissionais_pre_cadastro FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));