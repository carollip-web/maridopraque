-- Migration for temporary schedule reservation
CREATE TABLE IF NOT EXISTS public.profissional_bloqueios_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL REFERENCES auth.users(id),
  orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'temporario' CHECK (status IN ('temporario', 'confirmado', 'cancelado', 'expirado')),
  motivo text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.profissional_bloqueios_agenda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissionais podem gerenciar seus próprios bloqueios" ON public.profissional_bloqueios_agenda;
CREATE POLICY "Profissionais podem gerenciar seus próprios bloqueios"
  ON public.profissional_bloqueios_agenda FOR ALL
  TO authenticated
  USING (auth.uid() = profissional_id);

DROP POLICY IF EXISTS "Clientes podem ver bloqueios de seus orçamentos" ON public.profissional_bloqueios_agenda;
CREATE POLICY "Clientes podem ver bloqueios de seus orçamentos"
  ON public.profissional_bloqueios_agenda FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orcamentos
      WHERE id = orcamento_id AND cliente_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins podem tudo" ON public.profissional_bloqueios_agenda;
CREATE POLICY "Admins podem tudo"
  ON public.profissional_bloqueios_agenda FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    )
  );

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_profissional_bloqueios_agenda_updated_at ON public.profissional_bloqueios_agenda;
CREATE TRIGGER tr_profissional_bloqueios_agenda_updated_at
  BEFORE UPDATE ON public.profissional_bloqueios_agenda
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Index for expiration
CREATE INDEX IF NOT EXISTS idx_pba_expires_at ON public.profissional_bloqueios_agenda(expires_at);
CREATE INDEX IF NOT EXISTS idx_pba_orcamento_id ON public.profissional_bloqueios_agenda(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_pba_profissional_id ON public.profissional_bloqueios_agenda(profissional_id);
