CREATE TABLE IF NOT EXISTS public.mercadopago_preferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  pagamento_id uuid REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mp_preference_id text,
  init_point text,
  sandbox_init_point text,
  status text DEFAULT 'pending',
  mp_request jsonb,
  mp_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_pref_orcamento ON public.mercadopago_preferencias(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_mp_pref_pagamento ON public.mercadopago_preferencias(pagamento_id);
CREATE INDEX IF NOT EXISTS idx_mp_pref_cliente ON public.mercadopago_preferencias(cliente_id);

ALTER TABLE public.mercadopago_preferencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cliente vê suas preferências" ON public.mercadopago_preferencias;
CREATE POLICY "Cliente vê suas preferências"
  ON public.mercadopago_preferencias
  FOR SELECT
  USING (auth.uid() = cliente_id);

DROP POLICY IF EXISTS "Admins veem todas preferências MP" ON public.mercadopago_preferencias;
CREATE POLICY "Admins veem todas preferências MP"
  ON public.mercadopago_preferencias
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_mp_pref_updated_at ON public.mercadopago_preferencias;
CREATE TRIGGER trg_mp_pref_updated_at
  BEFORE UPDATE ON public.mercadopago_preferencias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();