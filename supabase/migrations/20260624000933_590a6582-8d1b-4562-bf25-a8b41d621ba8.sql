
-- 1) Add metragem_m2 to orcamentos
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS metragem_m2 numeric;

COMMENT ON COLUMN public.orcamentos.metragem_m2
  IS 'Área em m² informada pelo cliente para serviços tabelados por m² (ex.: Pintura, Refazer rejunte). Multiplicado pelo preço médio do range para calcular valor_servico.';

-- 2) Atualiza process_new_orcamento para considerar metragem quando o serviço é por m²
CREATE OR REPLACE FUNCTION public.process_new_orcamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  catalog_row public.services_catalog%ROWTYPE;
  total_pagos INT;
  v_preco_medio numeric;
  v_is_m2 boolean := false;
BEGIN
  IF NEW.service_id IS NOT NULL THEN
    SELECT * INTO catalog_row FROM public.services_catalog WHERE id = NEW.service_id;
    IF FOUND AND catalog_row.preco_min IS NOT NULL AND catalog_row.preco_max IS NOT NULL THEN
      v_preco_medio := ROUND(((catalog_row.preco_min + catalog_row.preco_max) / 2)::numeric, 2);

      -- Detecta serviço por m² no nome do catálogo
      v_is_m2 := catalog_row.nome ~* '\(m²?\)|\bm2\b|\bmetro quadrado\b';

      IF v_is_m2 AND NEW.metragem_m2 IS NOT NULL AND NEW.metragem_m2 > 0 THEN
        -- valor por m² × área informada
        NEW.valor_servico := ROUND((v_preco_medio * NEW.metragem_m2)::numeric, 2);
      ELSE
        -- comportamento antigo: sugere valor médio
        NEW.valor_servico := v_preco_medio;
      END IF;

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
$function$;
