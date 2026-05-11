CREATE TABLE public.mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL,
  remetente_id uuid NOT NULL,
  destinatario_id uuid NOT NULL,
  texto text NOT NULL,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mensagens_orc ON public.mensagens(orcamento_id, created_at);
CREATE INDEX idx_mensagens_dest ON public.mensagens(destinatario_id, lida);

ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes leem mensagens"
  ON public.mensagens FOR SELECT
  USING (auth.uid() = remetente_id OR auth.uid() = destinatario_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participante envia mensagem"
  ON public.mensagens FOR INSERT
  WITH CHECK (
    auth.uid() = remetente_id
    AND EXISTS (
      SELECT 1 FROM public.orcamentos o
      WHERE o.id = orcamento_id
        AND (o.cliente_id = auth.uid() OR o.profissional_id = auth.uid())
        AND (o.cliente_id = destinatario_id OR o.profissional_id = destinatario_id)
    )
  );

CREATE POLICY "Destinatario marca lida"
  ON public.mensagens FOR UPDATE
  USING (auth.uid() = destinatario_id) WITH CHECK (auth.uid() = destinatario_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
ALTER TABLE public.mensagens REPLICA IDENTITY FULL;

-- Notificação ao receber mensagem
CREATE OR REPLACE FUNCTION public.notify_nova_mensagem()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_service text;
  v_role text;
  v_link text;
BEGIN
  SELECT service_name INTO v_service FROM public.orcamentos WHERE id = NEW.orcamento_id;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.destinatario_id AND role = 'profissional') THEN
    v_link := '/profissional?orcamentoId=' || NEW.orcamento_id;
  ELSE
    v_link := '/cliente?tab=pedidos&pedidoId=' || NEW.orcamento_id;
  END IF;
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
  VALUES (
    NEW.destinatario_id,
    'Nova mensagem',
    'Nova mensagem sobre "' || COALESCE(v_service, 'seu orçamento') || '": ' || left(NEW.texto, 80),
    NEW.orcamento_id,
    v_link
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_nova_mensagem
AFTER INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.notify_nova_mensagem();