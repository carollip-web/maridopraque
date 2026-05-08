-- 1. services_catalog: ranges
ALTER TABLE public.services_catalog
  ADD COLUMN IF NOT EXISTS preco_min numeric,
  ADD COLUMN IF NOT EXISTS preco_max numeric;

-- 2. materiais
CREATE TABLE IF NOT EXISTS public.materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  unidade text NOT NULL DEFAULT 'un',
  preco_base numeric NOT NULL DEFAULT 0,
  preco_atual numeric NOT NULL DEFAULT 0,
  preco_fonte text NOT NULL DEFAULT 'tabela',
  preco_atualizado_em timestamptz NOT NULL DEFAULT now(),
  marketplace_url text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Materiais public read" ON public.materiais FOR SELECT USING (true);
CREATE POLICY "Admins manage materiais" ON public.materiais FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_materiais_updated BEFORE UPDATE ON public.materiais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. service_materiais
CREATE TABLE IF NOT EXISTS public.service_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL,
  material_id uuid NOT NULL,
  quantidade_sugerida numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, material_id)
);
ALTER TABLE public.service_materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service materiais public read" ON public.service_materiais FOR SELECT USING (true);
CREATE POLICY "Admins manage service materiais" ON public.service_materiais FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. orcamentos: campos novos
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS valor_servico numeric,
  ADD COLUMN IF NOT EXISTS taxa_material numeric NOT NULL DEFAULT 0;

-- 5. orcamento_materiais
CREATE TABLE IF NOT EXISTS public.orcamento_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL,
  material_id uuid NOT NULL,
  nome_snapshot text NOT NULL,
  unidade_snapshot text NOT NULL DEFAULT 'un',
  quantidade numeric NOT NULL DEFAULT 1,
  preco_unitario numeric NOT NULL DEFAULT 0,
  subtotal numeric GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orcamento_materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver materiais do próprio orçamento" ON public.orcamento_materiais
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orcamentos o
      WHERE o.id = orcamento_materiais.orcamento_id
        AND (auth.uid() = o.cliente_id
          OR auth.uid() = o.profissional_id
          OR has_role(auth.uid(), 'admin'::app_role)
          OR (has_role(auth.uid(), 'profissional'::app_role) AND o.profissional_id IS NULL))
    )
  );

CREATE POLICY "Cliente insere materiais no próprio orçamento" ON public.orcamento_materiais
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_id AND o.cliente_id = auth.uid())
  );

CREATE POLICY "Cliente remove materiais do próprio orçamento" ON public.orcamento_materiais
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.orcamentos o
      WHERE o.id = orcamento_id
        AND o.cliente_id = auth.uid()
        AND o.status IN ('customizado_pendente','fixo_auto'))
  );

-- 6. Trigger: recalcular taxa_material e valor total
CREATE OR REPLACE FUNCTION public.recalcular_orcamento_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  alvo uuid;
  total_mat numeric;
  v_serv numeric;
BEGIN
  alvo := COALESCE(NEW.orcamento_id, OLD.orcamento_id);
  SELECT COALESCE(SUM(subtotal),0) INTO total_mat FROM public.orcamento_materiais WHERE orcamento_id = alvo;
  SELECT COALESCE(valor_servico, 0) INTO v_serv FROM public.orcamentos WHERE id = alvo;
  UPDATE public.orcamentos
    SET taxa_material = total_mat,
        valor = COALESCE(valor_servico, 0) + total_mat
    WHERE id = alvo;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_om_recalc ON public.orcamento_materiais;
CREATE TRIGGER trg_om_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.orcamento_materiais
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_orcamento_total();

-- 7. Recalcular ao mudar valor_servico
CREATE OR REPLACE FUNCTION public.recalcular_orcamento_total_self()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.valor := COALESCE(NEW.valor_servico, 0) + COALESCE(NEW.taxa_material, 0);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_orc_valor ON public.orcamentos;
CREATE TRIGGER trg_orc_valor
  BEFORE INSERT OR UPDATE OF valor_servico, taxa_material ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_orcamento_total_self();

-- 8. Atualiza process_new_orcamento: usa range para sugerir valor_servico inicial
CREATE OR REPLACE FUNCTION public.process_new_orcamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  catalog_row public.services_catalog%ROWTYPE;
  total_pagos INT;
BEGIN
  IF NEW.service_id IS NOT NULL THEN
    SELECT * INTO catalog_row FROM public.services_catalog WHERE id = NEW.service_id;
    IF FOUND AND catalog_row.preco_min IS NOT NULL AND catalog_row.preco_max IS NOT NULL THEN
      -- sugere o valor médio do range; profissional ajusta dentro do range
      NEW.valor_servico := ROUND(((catalog_row.preco_min + catalog_row.preco_max)/2)::numeric, 2);
      NEW.status := 'customizado_pendente';

      SELECT total_servicos_pagos INTO total_pagos FROM public.profiles WHERE id = NEW.cliente_id;
      IF total_pagos IS NOT NULL AND total_pagos >= 3
         AND COALESCE(NEW.valor_servico,0) + COALESCE(NEW.taxa_material,0) <= 200 THEN
        NEW.auto_aprovado := true;
        NEW.status := 'aprovado';
        NEW.data_aprovacao := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 9. Seed materiais comuns
INSERT INTO public.materiais (nome, unidade, preco_base, preco_atual)
VALUES
  ('Bucha S6 (10un)', 'un', 5.50, 5.50),
  ('Parafuso 4x40 (10un)', 'un', 6.00, 6.00),
  ('Fita isolante 10m', 'un', 7.90, 7.90),
  ('Silicone neutro 280ml', 'un', 24.90, 24.90),
  ('Massa de calafetar 250g', 'un', 18.00, 18.00),
  ('Cabo flexível 2,5mm (m)', 'm', 3.50, 3.50),
  ('Vedação para torneira', 'un', 4.20, 4.20),
  ('Tinta acrílica 900ml', 'un', 39.90, 39.90)
ON CONFLICT DO NOTHING;

-- 10. Backfill de preço_min/max para serviços existentes (se houver preco_fixo)
UPDATE public.services_catalog
  SET preco_min = COALESCE(preco_min, ROUND((preco_fixo * 0.8)::numeric, 2)),
      preco_max = COALESCE(preco_max, ROUND((preco_fixo * 1.3)::numeric, 2))
  WHERE preco_fixo IS NOT NULL AND (preco_min IS NULL OR preco_max IS NULL);
