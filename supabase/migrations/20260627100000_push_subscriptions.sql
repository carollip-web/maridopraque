-- Fase 4 — Push notifications (Web Push)
-- Guarda as subscriptions de push de cada usuário (uma por dispositivo/endpoint).

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Cada usuário gerencia (lê/insere/atualiza/remove) só as próprias subscriptions.
-- A edge function de envio usa a service role, que ignora RLS.
DROP POLICY IF EXISTS "Usuário gerencia próprias subscriptions" ON public.push_subscriptions;
CREATE POLICY "Usuário gerencia próprias subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
