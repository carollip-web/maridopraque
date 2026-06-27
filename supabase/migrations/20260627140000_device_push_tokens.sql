-- Tokens de push NATIVO (FCM no Android, e iOS via Firebase/APNs).
-- Diferente de push_subscriptions (Web Push do navegador/PWA), esta tabela
-- guarda o token do dispositivo dado pelo Firebase dentro do app nativo.

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_id
  ON public.device_push_tokens (user_id);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

-- O usuário gerencia apenas os próprios tokens. O envio roda com service role
-- (bypass de RLS), então não precisa de policy de SELECT para terceiros.
DROP POLICY IF EXISTS "device_tokens_select_own" ON public.device_push_tokens;
CREATE POLICY "device_tokens_select_own" ON public.device_push_tokens
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "device_tokens_insert_own" ON public.device_push_tokens;
CREATE POLICY "device_tokens_insert_own" ON public.device_push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "device_tokens_update_own" ON public.device_push_tokens;
CREATE POLICY "device_tokens_update_own" ON public.device_push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "device_tokens_delete_own" ON public.device_push_tokens;
CREATE POLICY "device_tokens_delete_own" ON public.device_push_tokens
  FOR DELETE USING (auth.uid() = user_id);
