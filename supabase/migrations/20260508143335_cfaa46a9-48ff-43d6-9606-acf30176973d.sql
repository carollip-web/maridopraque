
-- Avaliações
CREATE TABLE public.avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL UNIQUE,
  cliente_id uuid NOT NULL,
  profissional_id uuid,
  nota smallint NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Avaliacoes leitura publica" ON public.avaliacoes FOR SELECT USING (true);
CREATE POLICY "Cliente cria avaliacao propria" ON public.avaliacoes FOR INSERT WITH CHECK (auth.uid() = cliente_id);
CREATE POLICY "Cliente atualiza avaliacao propria" ON public.avaliacoes FOR UPDATE USING (auth.uid() = cliente_id);

-- Perfil público profissional
CREATE TABLE public.profissional_perfil (
  user_id uuid PRIMARY KEY,
  slug text UNIQUE,
  bio text,
  especialidades text[] DEFAULT '{}',
  foto_url text,
  cidade text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profissional_perfil ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Perfil prof leitura publica" ON public.profissional_perfil FOR SELECT USING (true);
CREATE POLICY "Profissional edita proprio perfil" ON public.profissional_perfil FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin gerencia perfis" ON public.profissional_perfil FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_perfil_updated_at BEFORE UPDATE ON public.profissional_perfil FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indicações
CREATE TABLE public.indicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  codigo text NOT NULL UNIQUE,
  usos integer NOT NULL DEFAULT 0,
  desconto_percent integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario ve propria indicacao" ON public.indicacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuario cria propria indicacao" ON public.indicacoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Codigo publico para validar" ON public.indicacoes FOR SELECT USING (true);

-- Reagendamento
ALTER TABLE public.orcamentos ADD COLUMN data_agendada timestamptz;
ALTER TABLE public.orcamentos ADD COLUMN reagendamento_solicitado timestamptz;
