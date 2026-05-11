
-- 1) Recusas no radar
CREATE TABLE public.orcamento_recusas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL,
  profissional_id uuid NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orcamento_id, profissional_id)
);
ALTER TABLE public.orcamento_recusas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional cria propria recusa"
  ON public.orcamento_recusas FOR INSERT
  WITH CHECK (auth.uid() = profissional_id);

CREATE POLICY "Profissional ve propria recusa"
  ON public.orcamento_recusas FOR SELECT
  USING (auth.uid() = profissional_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Profissional remove propria recusa"
  ON public.orcamento_recusas FOR DELETE
  USING (auth.uid() = profissional_id);

CREATE INDEX idx_orcamento_recusas_prof ON public.orcamento_recusas(profissional_id);

-- 2) Check-in / Check-out geolocalizado
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS checkin_em timestamptz,
  ADD COLUMN IF NOT EXISTS checkin_lat double precision,
  ADD COLUMN IF NOT EXISTS checkin_lng double precision,
  ADD COLUMN IF NOT EXISTS checkout_em timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_lat double precision,
  ADD COLUMN IF NOT EXISTS checkout_lng double precision;

-- 3) Botão de pânico
CREATE TABLE public.panico_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  orcamento_id uuid,
  lat double precision,
  lng double precision,
  observacao text,
  resolvido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.panico_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario cria proprio panico"
  ON public.panico_eventos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuario ve proprio panico"
  ON public.panico_eventos FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin atualiza panico"
  ON public.panico_eventos FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_panico_created ON public.panico_eventos(created_at DESC);

-- Notifica admins quando há pânico
CREATE OR REPLACE FUNCTION public.notify_panico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
  SELECT ur.user_id,
    '🚨 Botão de pânico acionado',
    'Um usuário acionou o botão de emergência. Verifique imediatamente.',
    NEW.orcamento_id,
    '/admin?tab=panico'
  FROM public.user_roles ur WHERE ur.role = 'admin';
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_panico() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_panico
AFTER INSERT ON public.panico_eventos
FOR EACH ROW EXECUTE FUNCTION public.notify_panico();
