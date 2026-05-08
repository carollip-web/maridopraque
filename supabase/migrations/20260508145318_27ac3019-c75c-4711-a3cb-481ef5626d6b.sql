CREATE TABLE public.cliente_enderecos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  rotulo TEXT NOT NULL DEFAULT 'Casa',
  cep TEXT,
  logradouro TEXT NOT NULL,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  is_padrao BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cliente_enderecos_unico_padrao
  ON public.cliente_enderecos(user_id) WHERE is_padrao;

ALTER TABLE public.cliente_enderecos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve proprios enderecos"
  ON public.cliente_enderecos FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuario cria proprio endereco"
  ON public.cliente_enderecos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuario edita proprio endereco"
  ON public.cliente_enderecos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuario remove proprio endereco"
  ON public.cliente_enderecos FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER cliente_enderecos_updated_at
  BEFORE UPDATE ON public.cliente_enderecos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();