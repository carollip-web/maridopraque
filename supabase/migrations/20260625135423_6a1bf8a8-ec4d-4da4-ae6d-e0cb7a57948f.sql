
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS email_enviado boolean NOT NULL DEFAULT false;

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.fn_notificacao_dispara_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://maridopraque.lovable.app/api/public/hooks/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZm9ubXB1ZXBxZmhpdnZvcWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTg1ODYsImV4cCI6MjA5MzU3NDU4Nn0._g2VD4-3LnaR6ab_23aIyg6mVGbZnBJ3OyAhTjSL0VY'
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificacoes_email ON public.notificacoes;
CREATE TRIGGER trg_notificacoes_email
AFTER INSERT ON public.notificacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_notificacao_dispara_email();
