
-- 1) Novas colunas no perfil
ALTER TABLE public.profissional_perfil
  ADD COLUMN IF NOT EXISTS aguardando_reenvio_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloqueado_em timestamptz,
  ADD COLUMN IF NOT EXISTS bloqueado_por uuid;

-- 2) Histórico de alterações campo a campo
CREATE TABLE IF NOT EXISTS public.profissional_perfil_alteracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_user_id uuid NOT NULL,
  campo text NOT NULL,
  valor_antigo text,
  valor_novo text,
  alterado_por uuid,
  alterado_por_role text,
  origem text NOT NULL DEFAULT 'admin', -- 'admin' | 'profissional'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perfil_alteracoes_user
  ON public.profissional_perfil_alteracoes(profissional_user_id, created_at DESC);

GRANT SELECT, INSERT ON public.profissional_perfil_alteracoes TO authenticated;
GRANT ALL ON public.profissional_perfil_alteracoes TO service_role;

ALTER TABLE public.profissional_perfil_alteracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode ver alteracoes"
  ON public.profissional_perfil_alteracoes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode inserir alteracoes"
  ON public.profissional_perfil_alteracoes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR alterado_por = auth.uid());

CREATE POLICY "Profissional ve suas alteracoes"
  ON public.profissional_perfil_alteracoes
  FOR SELECT TO authenticated
  USING (profissional_user_id = auth.uid());
