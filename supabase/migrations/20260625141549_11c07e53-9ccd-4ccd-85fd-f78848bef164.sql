
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  assunto text NOT NULL,
  html text NOT NULL,
  variaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email templates"
  ON public.email_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.tg_email_templates_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.tg_email_templates_updated_at();

-- Seed: dois templates base (notificação + mensagem admin)
INSERT INTO public.email_templates (slug, nome, descricao, assunto, variaveis, html) VALUES
('notificacao', 'Notificação genérica', 'Enviado automaticamente quando uma notificação é criada para um usuário.',
 '{{titulo}}',
 '["titulo","mensagem","link","app_url"]'::jsonb,
 '<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.06)">
      <tr><td style="background:#FF6B35;padding:18px 24px;color:#fff;font-weight:700;font-size:16px">Marido pra Quê?</td></tr>
      <tr><td style="padding:28px 24px">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">{{titulo}}</h1>
        <p style="margin:0;font-size:15px;line-height:1.55;color:#334155">{{mensagem}}</p>
        {{cta}}
      </td></tr>
      <tr><td style="padding:18px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">Você está recebendo este e-mail porque tem uma conta no Marido pra Quê.</td></tr>
    </table>
  </td></tr></table></body></html>'),
('admin_contato', 'Contato manual do admin', 'Usado quando um admin envia um e-mail diretamente pelo painel de validação.',
 '{{assunto}}',
 '["nome","mensagem","app_url"]'::jsonb,
 '<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.06)">
      <tr><td style="background:#FF6B35;padding:18px 24px;color:#fff;font-weight:700;font-size:16px">Marido pra Quê?</td></tr>
      <tr><td style="padding:28px 24px">
        <p style="margin:0 0 12px;font-size:15px">Olá {{nome}},</p>
        <div style="font-size:15px;line-height:1.55;color:#334155;white-space:pre-wrap">{{mensagem}}</div>
      </td></tr>
      <tr><td style="padding:18px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">Equipe Marido pra Quê · contato@maridopraque.com</td></tr>
    </table>
  </td></tr></table></body></html>')
ON CONFLICT (slug) DO NOTHING;
