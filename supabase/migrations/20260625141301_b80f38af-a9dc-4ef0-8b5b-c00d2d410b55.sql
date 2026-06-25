
CREATE OR REPLACE FUNCTION public.fn_notificacao_dispara_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://www.maridopraque.com/api/public/hooks/send-notification-email',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.notificacoes
    WHERE email_enviado = false
      AND created_at > now() - interval '7 days'
    ORDER BY created_at ASC
  LOOP
    PERFORM net.http_post(
      url := 'https://www.maridopraque.com/api/public/hooks/send-notification-email',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('notification_id', r.id)
    );
  END LOOP;
END $$;
