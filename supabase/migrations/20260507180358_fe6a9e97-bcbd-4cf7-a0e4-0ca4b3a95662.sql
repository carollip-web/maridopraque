
-- Roles enum & table
CREATE TYPE public.app_role AS ENUM ('cliente', 'profissional', 'admin');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  whatsapp TEXT,
  total_servicos_pagos INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by self or admin/professional" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'profissional'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Services catalog
CREATE TABLE public.services_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT,
  preco_fixo NUMERIC(10,2),
  is_fixed_price BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.services_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalog public read" ON public.services_catalog FOR SELECT USING (true);
CREATE POLICY "Admins manage catalog" ON public.services_catalog FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Orcamentos
CREATE TYPE public.orcamento_status AS ENUM (
  'fixo_auto',
  'customizado_pendente',
  'enviado',
  'aprovado',
  'recusado',
  'pago',
  'cancelado'
);

CREATE TABLE public.orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profissional_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services_catalog(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(10,2),
  status orcamento_status NOT NULL DEFAULT 'customizado_pendente',
  auto_aprovado BOOLEAN NOT NULL DEFAULT false,
  observacoes_profissional TEXT,
  data_aprovacao TIMESTAMPTZ,
  data_pagamento TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente vê próprios orçamentos" ON public.orcamentos
  FOR SELECT USING (
    auth.uid() = cliente_id
    OR auth.uid() = profissional_id
    OR public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'profissional') AND profissional_id IS NULL)
  );

CREATE POLICY "Cliente cria orçamento" ON public.orcamentos
  FOR INSERT WITH CHECK (auth.uid() = cliente_id);

CREATE POLICY "Cliente/profissional/admin atualizam" ON public.orcamentos
  FOR UPDATE USING (
    auth.uid() = cliente_id
    OR auth.uid() = profissional_id
    OR public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'profissional') AND profissional_id IS NULL)
  );

-- Notificações
CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link TEXT,
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê próprias notificações" ON public.notificacoes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuário marca lidas" ON public.notificacoes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Sistema/admin insere notificações" ON public.notificacoes
  FOR INSERT WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER orcamentos_updated BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- New user: create profile + cliente role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-fill orçamento (preço fixo + auto-aprovação)
CREATE OR REPLACE FUNCTION public.process_new_orcamento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  catalog_row public.services_catalog%ROWTYPE;
  total_pagos INT;
BEGIN
  IF NEW.service_id IS NOT NULL THEN
    SELECT * INTO catalog_row FROM public.services_catalog WHERE id = NEW.service_id;
    IF FOUND AND catalog_row.is_fixed_price AND catalog_row.preco_fixo IS NOT NULL THEN
      NEW.valor := catalog_row.preco_fixo;
      NEW.status := 'fixo_auto';

      SELECT total_servicos_pagos INTO total_pagos FROM public.profiles WHERE id = NEW.cliente_id;
      IF total_pagos IS NOT NULL AND total_pagos >= 3 AND NEW.valor <= 200 THEN
        NEW.auto_aprovado := true;
        NEW.status := 'aprovado';
        NEW.data_aprovacao := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orcamentos_process_new
  BEFORE INSERT ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.process_new_orcamento();

-- Notificar cliente quando profissional envia orçamento OU quando auto-aprovado
CREATE OR REPLACE FUNCTION public.notify_orcamento_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'aprovado' AND NEW.auto_aprovado THEN
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
    VALUES (NEW.cliente_id,
      'Orçamento aprovado automaticamente',
      'Seu pedido "' || NEW.service_name || '" foi aprovado. Prossiga para o pagamento.',
      NEW.id, '/cliente?tab=pedidos&pedidoId=' || NEW.id);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'enviado' THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
      VALUES (NEW.cliente_id,
        'Orçamento pronto para sua aprovação',
        'O profissional enviou um orçamento de R$ ' || NEW.valor || ' para "' || NEW.service_name || '".',
        NEW.id, '/cliente?tab=pedidos&pedidoId=' || NEW.id);
    ELSIF NEW.status = 'aprovado' AND NOT NEW.auto_aprovado AND NEW.profissional_id IS NOT NULL THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
      VALUES (NEW.profissional_id,
        'Orçamento aprovado pelo cliente',
        'O cliente aprovou o orçamento de "' || NEW.service_name || '".',
        NEW.id, '/profissional?orcamentoId=' || NEW.id);
    ELSIF NEW.status = 'pago' THEN
      UPDATE public.profiles SET total_servicos_pagos = total_servicos_pagos + 1
        WHERE id = NEW.cliente_id;
    END IF;
  END IF;

  -- Quando customizado_pendente, notifica profissionais (todos com role profissional)
  IF TG_OP = 'INSERT' AND NEW.status = 'customizado_pendente' THEN
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
    SELECT ur.user_id,
      'Nova solicitação de orçamento',
      'Cliente pediu orçamento para "' || NEW.service_name || '".',
      NEW.id, '/profissional?orcamentoId=' || NEW.id
    FROM public.user_roles ur WHERE ur.role = 'profissional';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orcamentos_notify
  AFTER INSERT OR UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.notify_orcamento_change();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orcamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

-- Seed catálogo (preços fixos baseados em /servicos)
INSERT INTO public.services_catalog (nome, categoria, descricao, preco_fixo, is_fixed_price) VALUES
  ('Cama solteiro/casal', 'montagem', 'Montagem de cama padrão', 120, true),
  ('Guarda-roupa (por porta)', 'montagem', 'Montagem de guarda-roupa cobrada por porta', 60, true),
  ('Kit fixação (até 5 furos)', 'montagem', 'Furos e fixação de quadros/prateleiras', 80, true),
  ('Suporte de TV articulado', 'montagem', 'Instalação de suporte de TV', 130, true),
  ('Varal de teto/parede', 'montagem', 'Instalação de varal', 100, true),
  ('Cortinas e persianas (par)', 'montagem', 'Instalação de cortinas/persianas', 90, true),
  ('Troca de resistência chuveiro', 'reparos', 'Substituição de resistência', 80, true),
  ('Instalação de ventilador teto', 'reparos', 'Montagem completa', 150, true),
  ('Troca de tomada/interruptor', 'reparos', 'Por unidade', 40, true),
  ('Conserto vazamento torneira', 'reparos', 'Reparo simples', 70, true),
  ('Reparo de descarga', 'reparos', 'Mão de obra', 110, true),
  ('Painel de TV/Estante', 'montagem', 'Sob orçamento', NULL, false),
  ('Cozinha completa', 'montagem', 'Sob orçamento', NULL, false),
  ('Legalização de projeto', 'engenharia', 'Sob orçamento', NULL, false);
