
CREATE TABLE public.admin_contato_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL,
  destinatario_user_id uuid,
  destinatario_email text,
  destinatario_telefone text,
  canal text NOT NULL CHECK (canal IN ('whatsapp','telefone','outro')),
  assunto text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_contato_log_dest_user ON public.admin_contato_log(destinatario_user_id);
CREATE INDEX idx_admin_contato_log_dest_email ON public.admin_contato_log(destinatario_email);
CREATE INDEX idx_admin_contato_log_created ON public.admin_contato_log(created_at DESC);

GRANT SELECT, INSERT ON public.admin_contato_log TO authenticated;
GRANT ALL ON public.admin_contato_log TO service_role;

ALTER TABLE public.admin_contato_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem contatos"
ON public.admin_contato_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins inserem contatos"
ON public.admin_contato_log FOR INSERT TO authenticated
WITH CHECK (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::app_role));
