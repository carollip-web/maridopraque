
CREATE TABLE public.plataforma_config (
  id integer PRIMARY KEY DEFAULT 1,
  marca_nome text NOT NULL DEFAULT 'Marido pra Quê',
  marca_assinatura text NOT NULL DEFAULT 'Equipe Marido pra Quê',
  whatsapp_templates jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT plataforma_config_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.plataforma_config TO authenticated;
GRANT ALL ON public.plataforma_config TO service_role;

ALTER TABLE public.plataforma_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ler config" ON public.plataforma_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem alterar config" ON public.plataforma_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.plataforma_config (id, whatsapp_templates) VALUES (
  1,
  '[
    {"id":"cobranca_documentos","titulo":"Cobrança de documentos","mensagem":"Olá {{nome}}, aqui é da equipe {{marca}}. Notamos que faltam alguns documentos para concluir seu cadastro. Pode nos enviar para finalizarmos sua validação?"},
    {"id":"retomar_cadastro","titulo":"Retomar cadastro","mensagem":"Olá {{nome}}, aqui é da equipe {{marca}}. Vimos que você começou seu cadastro mas não finalizou. Posso te ajudar a concluir?"},
    {"id":"boas_vindas","titulo":"Boas-vindas","mensagem":"Olá {{nome}}, seja bem-vindo(a) à {{marca}}! Qualquer dúvida estamos à disposição."}
  ]'::jsonb
) ON CONFLICT (id) DO NOTHING;
