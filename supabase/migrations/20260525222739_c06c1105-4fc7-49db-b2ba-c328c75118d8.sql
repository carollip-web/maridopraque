
-- =========================================================
-- 1. financeiro_config (singleton)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.financeiro_config (
  id boolean PRIMARY KEY DEFAULT true,
  taxa_plataforma_percent numeric NOT NULL DEFAULT 15,
  taxa_gateway_percent numeric NOT NULL DEFAULT 0,
  taxa_gateway_fixa numeric NOT NULL DEFAULT 0,
  dias_liberacao integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_config_singleton CHECK (id = true)
);

INSERT INTO public.financeiro_config (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.financeiro_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins veem config financeira" ON public.financeiro_config;
CREATE POLICY "Admins veem config financeira" ON public.financeiro_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role = 'admin'::app_role
              AND (ur.admin_level)::text IN ('super_admin','financeiro'))
  );

DROP POLICY IF EXISTS "Super admin atualiza config financeira" ON public.financeiro_config;
CREATE POLICY "Super admin atualiza config financeira" ON public.financeiro_config
  FOR UPDATE USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- =========================================================
-- 2. pagamento_splits
-- =========================================================
CREATE TABLE IF NOT EXISTS public.pagamento_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id uuid NOT NULL UNIQUE REFERENCES public.pagamentos(id) ON DELETE CASCADE,
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  profissional_id uuid NOT NULL REFERENCES auth.users(id),
  cliente_id uuid NOT NULL REFERENCES auth.users(id),
  valor_total numeric NOT NULL,
  taxa_plataforma numeric NOT NULL DEFAULT 0,
  taxa_gateway numeric NOT NULL DEFAULT 0,
  valor_profissional numeric NOT NULL,
  status text NOT NULL DEFAULT 'aguardando_conclusao',
  disponivel_em timestamptz NULL,
  pago_em timestamptz NULL,
  gateway text NULL,
  gateway_payment_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagamento_splits_status_chk CHECK (
    status IN ('aguardando_conclusao','disponivel','solicitado','pago','retido','estornado','cancelado')
  )
);

CREATE INDEX IF NOT EXISTS pagamento_splits_profissional_idx ON public.pagamento_splits(profissional_id);
CREATE INDEX IF NOT EXISTS pagamento_splits_status_idx ON public.pagamento_splits(status);

ALTER TABLE public.pagamento_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional ve proprios splits" ON public.pagamento_splits;
CREATE POLICY "Profissional ve proprios splits" ON public.pagamento_splits
  FOR SELECT USING (auth.uid() = profissional_id);

DROP POLICY IF EXISTS "Admin financeiro gerencia splits" ON public.pagamento_splits;
CREATE POLICY "Admin financeiro gerencia splits" ON public.pagamento_splits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND (ur.role = 'admin'::app_role)
              AND (ur.admin_level)::text IN ('super_admin','financeiro'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND (ur.role = 'admin'::app_role)
              AND (ur.admin_level)::text IN ('super_admin','financeiro'))
  );

-- =========================================================
-- 3. profissional_saldos
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profissional_saldos (
  profissional_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  saldo_disponivel numeric NOT NULL DEFAULT 0,
  saldo_a_liberar numeric NOT NULL DEFAULT 0,
  saldo_pago numeric NOT NULL DEFAULT 0,
  saldo_retido numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profissional_saldos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional ve proprio saldo" ON public.profissional_saldos;
CREATE POLICY "Profissional ve proprio saldo" ON public.profissional_saldos
  FOR SELECT USING (auth.uid() = profissional_id);

DROP POLICY IF EXISTS "Admin financeiro ve saldos" ON public.profissional_saldos;
CREATE POLICY "Admin financeiro ve saldos" ON public.profissional_saldos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND (ur.role = 'admin'::app_role)
              AND (ur.admin_level)::text IN ('super_admin','financeiro'))
  );

-- =========================================================
-- 4. profissional_saques
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profissional_saques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor numeric NOT NULL CHECK (valor > 0),
  status text NOT NULL DEFAULT 'solicitado',
  chave_pix text NULL,
  observacao text NULL,
  comprovante_url text NULL,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  aprovado_em timestamptz NULL,
  pago_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profissional_saques_status_chk CHECK (
    status IN ('solicitado','aprovado','pago','recusado','cancelado')
  )
);

CREATE INDEX IF NOT EXISTS profissional_saques_profissional_idx ON public.profissional_saques(profissional_id);
CREATE INDEX IF NOT EXISTS profissional_saques_status_idx ON public.profissional_saques(status);

ALTER TABLE public.profissional_saques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional ve proprios saques" ON public.profissional_saques;
CREATE POLICY "Profissional ve proprios saques" ON public.profissional_saques
  FOR SELECT USING (
    auth.uid() = profissional_id
    OR EXISTS (SELECT 1 FROM public.user_roles ur
               WHERE ur.user_id = auth.uid()
                 AND (ur.role = 'admin'::app_role)
                 AND (ur.admin_level)::text IN ('super_admin','financeiro'))
  );

DROP POLICY IF EXISTS "Profissional cria proprio saque" ON public.profissional_saques;
CREATE POLICY "Profissional cria proprio saque" ON public.profissional_saques
  FOR INSERT WITH CHECK (
    auth.uid() = profissional_id
    AND valor > 0
    AND status = 'solicitado'
  );

DROP POLICY IF EXISTS "Admin financeiro atualiza saques" ON public.profissional_saques;
CREATE POLICY "Admin financeiro atualiza saques" ON public.profissional_saques
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND (ur.role = 'admin'::app_role)
              AND (ur.admin_level)::text IN ('super_admin','financeiro'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND (ur.role = 'admin'::app_role)
              AND (ur.admin_level)::text IN ('super_admin','financeiro'))
  );

-- =========================================================
-- 5. Função: recalcular saldos do profissional
-- =========================================================
CREATE OR REPLACE FUNCTION public.recalcular_saldos_profissional(_profissional_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a_liberar numeric;
  v_disponivel numeric;
  v_pago numeric;
  v_retido numeric;
BEGIN
  SELECT COALESCE(SUM(valor_profissional) FILTER (WHERE status = 'aguardando_conclusao'), 0),
         COALESCE(SUM(valor_profissional) FILTER (WHERE status IN ('disponivel','solicitado')), 0),
         COALESCE(SUM(valor_profissional) FILTER (WHERE status = 'pago'), 0),
         COALESCE(SUM(valor_profissional) FILTER (WHERE status = 'retido'), 0)
    INTO v_a_liberar, v_disponivel, v_pago, v_retido
  FROM public.pagamento_splits
  WHERE profissional_id = _profissional_id;

  INSERT INTO public.profissional_saldos (
    profissional_id, saldo_a_liberar, saldo_disponivel, saldo_pago, saldo_retido, updated_at
  ) VALUES (
    _profissional_id, v_a_liberar, v_disponivel, v_pago, v_retido, now()
  )
  ON CONFLICT (profissional_id) DO UPDATE
    SET saldo_a_liberar = EXCLUDED.saldo_a_liberar,
        saldo_disponivel = EXCLUDED.saldo_disponivel,
        saldo_pago = EXCLUDED.saldo_pago,
        saldo_retido = EXCLUDED.saldo_retido,
        updated_at = now();
END;
$$;

-- Trigger para manter saldos sempre em dia
CREATE OR REPLACE FUNCTION public.trg_pagamento_splits_atualiza_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_saldos_profissional(OLD.profissional_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalcular_saldos_profissional(NEW.profissional_id);
  IF TG_OP = 'UPDATE' AND OLD.profissional_id IS DISTINCT FROM NEW.profissional_id THEN
    PERFORM public.recalcular_saldos_profissional(OLD.profissional_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pagamento_splits_saldos_trg ON public.pagamento_splits;
CREATE TRIGGER pagamento_splits_saldos_trg
AFTER INSERT OR UPDATE OR DELETE ON public.pagamento_splits
FOR EACH ROW EXECUTE FUNCTION public.trg_pagamento_splits_atualiza_saldo();

-- =========================================================
-- 6. criar_split_pagamento
-- =========================================================
CREATE OR REPLACE FUNCTION public.criar_split_pagamento(_pagamento_id uuid)
RETURNS public.pagamento_splits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pag public.pagamentos%ROWTYPE;
  v_orc public.orcamentos%ROWTYPE;
  v_cfg public.financeiro_config%ROWTYPE;
  v_split public.pagamento_splits%ROWTYPE;
  v_taxa_plat numeric;
  v_taxa_gw numeric;
  v_liq numeric;
  v_prof uuid;
BEGIN
  SELECT * INTO v_pag FROM public.pagamentos WHERE id = _pagamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento % não encontrado', _pagamento_id;
  END IF;

  -- idempotente
  SELECT * INTO v_split FROM public.pagamento_splits WHERE pagamento_id = _pagamento_id;
  IF FOUND THEN
    RETURN v_split;
  END IF;

  SELECT * INTO v_orc FROM public.orcamentos WHERE id = v_pag.orcamento_id;
  v_prof := COALESCE(v_pag.profissional_id, v_orc.profissional_id);
  IF v_prof IS NULL THEN
    RAISE EXCEPTION 'Sem profissional definido para pagamento %', _pagamento_id;
  END IF;

  SELECT * INTO v_cfg FROM public.financeiro_config WHERE id = true;
  IF NOT FOUND THEN
    v_cfg.taxa_plataforma_percent := 15;
    v_cfg.taxa_gateway_percent := 0;
    v_cfg.taxa_gateway_fixa := 0;
    v_cfg.dias_liberacao := 1;
  END IF;

  v_taxa_plat := ROUND((COALESCE(v_pag.valor_total,0) * v_cfg.taxa_plataforma_percent / 100.0)::numeric, 2);
  v_taxa_gw := ROUND((COALESCE(v_pag.valor_total,0) * v_cfg.taxa_gateway_percent / 100.0)::numeric, 2)
               + COALESCE(v_cfg.taxa_gateway_fixa, 0);
  v_liq := COALESCE(v_pag.valor_total,0) - v_taxa_plat - v_taxa_gw;

  INSERT INTO public.pagamento_splits (
    pagamento_id, orcamento_id, profissional_id, cliente_id,
    valor_total, taxa_plataforma, taxa_gateway, valor_profissional,
    status, gateway, gateway_payment_id
  ) VALUES (
    v_pag.id, v_pag.orcamento_id, v_prof, v_pag.cliente_id,
    COALESCE(v_pag.valor_total,0), v_taxa_plat, v_taxa_gw, v_liq,
    'aguardando_conclusao', v_pag.gateway, v_pag.gateway_payment_id
  )
  RETURNING * INTO v_split;

  RETURN v_split;
END;
$$;

-- Trigger no pagamento: ao virar paid, criar split
CREATE OR REPLACE FUNCTION public.trg_pagamento_paid_cria_split()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    BEGIN
      PERFORM public.criar_split_pagamento(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'criar_split_pagamento falhou para pagamento %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pagamentos_paid_split_trg ON public.pagamentos;
CREATE TRIGGER pagamentos_paid_split_trg
AFTER INSERT OR UPDATE OF status ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_pagamento_paid_cria_split();

-- =========================================================
-- 7. Liberar splits ao concluir orçamento
-- =========================================================
CREATE OR REPLACE FUNCTION public.trg_orcamento_concluido_libera_split()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg public.financeiro_config%ROWTYPE;
  v_disp timestamptz;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status::text IS DISTINCT FROM NEW.status::text
     AND NEW.status::text = 'concluido' THEN

    SELECT * INTO v_cfg FROM public.financeiro_config WHERE id = true;
    IF COALESCE(v_cfg.dias_liberacao, 0) <= 0 THEN
      v_disp := now();
    ELSE
      v_disp := now() + make_interval(days => v_cfg.dias_liberacao);
    END IF;

    UPDATE public.pagamento_splits
       SET status = CASE WHEN v_disp <= now() THEN 'disponivel' ELSE status END,
           disponivel_em = v_disp,
           updated_at = now()
     WHERE orcamento_id = NEW.id
       AND status = 'aguardando_conclusao';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orcamentos_concluido_split_trg ON public.orcamentos;
CREATE TRIGGER orcamentos_concluido_split_trg
AFTER UPDATE OF status ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_orcamento_concluido_libera_split();

-- =========================================================
-- 8. Job utilitário: liberar splits vencidos (dias_liberacao>0)
-- =========================================================
CREATE OR REPLACE FUNCTION public.liberar_splits_vencidos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.pagamento_splits
       SET status = 'disponivel', updated_at = now()
     WHERE status = 'aguardando_conclusao'
       AND disponivel_em IS NOT NULL
       AND disponivel_em <= now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

-- =========================================================
-- 9. Saque: marcar pago atualiza splits e saldos
-- =========================================================
CREATE OR REPLACE FUNCTION public.processar_saque_pago(_saque_id uuid)
RETURNS public.profissional_saques
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saque public.profissional_saques%ROWTYPE;
  v_admin boolean;
  v_restante numeric;
  v_row record;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = auth.uid()
                   AND (ur.role = 'admin'::app_role)
                   AND (ur.admin_level)::text IN ('super_admin','financeiro'))
    INTO v_admin;
  IF NOT v_admin THEN
    RAISE EXCEPTION 'Apenas admin financeiro pode processar saques';
  END IF;

  SELECT * INTO v_saque FROM public.profissional_saques WHERE id = _saque_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque % não encontrado', _saque_id; END IF;
  IF v_saque.status = 'pago' THEN RETURN v_saque; END IF;

  v_restante := v_saque.valor;
  FOR v_row IN
    SELECT id, valor_profissional FROM public.pagamento_splits
     WHERE profissional_id = v_saque.profissional_id
       AND status IN ('disponivel','solicitado')
     ORDER BY disponivel_em NULLS FIRST, created_at
  LOOP
    EXIT WHEN v_restante <= 0;
    UPDATE public.pagamento_splits
       SET status = 'pago', pago_em = now(), updated_at = now()
     WHERE id = v_row.id;
    v_restante := v_restante - v_row.valor_profissional;
  END LOOP;

  UPDATE public.profissional_saques
     SET status = 'pago', pago_em = now()
   WHERE id = _saque_id
   RETURNING * INTO v_saque;

  RETURN v_saque;
END;
$$;
