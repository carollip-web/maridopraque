-- Disponibilidade semanal recorrente
CREATE TABLE public.profissional_disponibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (hora_fim > hora_inicio)
);

CREATE INDEX idx_disp_user ON public.profissional_disponibilidade(user_id, dia_semana);

ALTER TABLE public.profissional_disponibilidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Disponibilidade leitura publica"
  ON public.profissional_disponibilidade FOR SELECT USING (true);

CREATE POLICY "Profissional gerencia propria disponibilidade"
  ON public.profissional_disponibilidade FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin gerencia disponibilidade"
  ON public.profissional_disponibilidade FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Bloqueios pontuais (férias, dias indisponíveis)
CREATE TABLE public.profissional_bloqueios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data_inicio timestamptz NOT NULL,
  data_fim timestamptz NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim > data_inicio)
);

CREATE INDEX idx_bloq_user_periodo ON public.profissional_bloqueios(user_id, data_inicio, data_fim);

ALTER TABLE public.profissional_bloqueios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bloqueios leitura publica"
  ON public.profissional_bloqueios FOR SELECT USING (true);

CREATE POLICY "Profissional gerencia proprios bloqueios"
  ON public.profissional_bloqueios FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin gerencia bloqueios"
  ON public.profissional_bloqueios FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Duração padrão de atendimento (minutos) para calcular slots
ALTER TABLE public.profissional_perfil
  ADD COLUMN IF NOT EXISTS duracao_padrao_min integer NOT NULL DEFAULT 60;