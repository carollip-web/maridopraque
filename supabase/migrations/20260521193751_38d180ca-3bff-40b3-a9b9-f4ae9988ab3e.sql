ALTER TABLE public.services_catalog
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS complexidade text,
  ADD COLUMN IF NOT EXISTS custo_profissional numeric,
  ADD COLUMN IF NOT EXISTS operacao_plataforma_factor numeric,
  ADD COLUMN IF NOT EXISTS risco_garantia_factor numeric,
  ADD COLUMN IF NOT EXISTS custo_base_real numeric,
  ADD COLUMN IF NOT EXISTS markup_margem_empresa numeric,
  ADD COLUMN IF NOT EXISTS fator_precificacao_maxima numeric,
  ADD COLUMN IF NOT EXISTS preco_min_prestador numeric,
  ADD COLUMN IF NOT EXISTS preco_max_prestador numeric,
  ADD COLUMN IF NOT EXISTS apoio_feminino_valor numeric,
  ADD COLUMN IF NOT EXISTS urgencia_noturno_factor numeric,
  ADD COLUMN IF NOT EXISTS domingo_feriado_factor numeric,
  ADD COLUMN IF NOT EXISTS mpq_tabela_rev text;

ALTER TABLE public.services_catalog
  ALTER COLUMN comissao_marketplace_pct SET DEFAULT 15;

UPDATE public.services_catalog SET comissao_marketplace_pct = 15 WHERE comissao_marketplace_pct IS NULL;

DROP INDEX IF EXISTS public.services_catalog_slug_key;
CREATE UNIQUE INDEX services_catalog_slug_key ON public.services_catalog (slug);

UPDATE public.services_catalog SET ativo = false;

WITH data(slug, nome, categoria, complexidade, custo_profissional, operacao_plataforma_factor, risco_garantia_factor, custo_base_real, markup_margem_empresa, preco_min, fator_precificacao_maxima, preco_max, preco_min_prestador, preco_max_prestador, apoio_feminino_valor, urgencia_noturno_factor, domingo_feriado_factor) AS (
  VALUES
    ('consultoria-art','Consultoria/ART','engenharia','COMPLEXO',550,1.15,1.05,660.00,1.16,765.60,NULL::numeric,NULL::numeric,550,NULL::numeric,40,1.2,1.2),
    ('legalizacao-projeto','Legalização de projeto','engenharia','COMPLEXO',750,1.15,1.05,900.00,1.16,1044.00,NULL,NULL,750,NULL,40,1.2,1.2),
    ('cama-solteiro-casal','Cama solteiro/casal','montagem','SIMPLES',105,1.15,1.05,126.00,1.16,146.16,1.4,237.36,105,204.62,40,1.2,1.2),
    ('cortinas-persianas','Cortinas e persianas','montagem','SIMPLES',105,1.15,1.05,126.00,1.16,146.16,1.4,237.36,105,204.62,40,1.2,1.2),
    ('guarda-roupa-por-porta','Guarda-roupa (por porta)','montagem','MÉDIO',110,1.15,1.05,132.00,1.16,153.12,1.4,248.67,110,214.37,40,1.2,1.2),
    ('kit-fixacao','Kit fixação','montagem','SIMPLES',80,1.15,1.05,96.00,1.16,111.36,1.4,180.85,80,155.90,40,1.2,1.2),
    ('painel-tv-estante','Painel TV/Estante','montagem','MÉDIO',120,1.15,1.05,144.00,1.16,167.04,1.4,271.27,120,233.86,40,1.2,1.2),
    ('suporte-tv-articulado','Suporte TV articulado','montagem','MÉDIO',105,1.15,1.05,126.00,1.16,146.16,1.4,237.36,105,204.62,40,1.2,1.2),
    ('varal-teto-parede','Varal teto/parede','montagem','MÉDIO',105,1.15,1.05,126.00,1.16,146.16,1.4,237.36,105,204.62,40,1.2,1.2),
    ('conserto-vazamento-torneira','Conserto vazamento torneira','hidráulica','SIMPLES',80,1.15,1.05,96.00,1.16,111.36,1.6,206.68,80,178.18,40,1.2,1.2),
    ('instalacao-ventilador-teto','Instalação ventilador teto','elétrica','COMPLEXO',110,1.15,1.05,132.00,1.16,153.12,1.6,284.19,110,244.99,40,1.2,1.2),
    ('reparo-descarga','Reparo descarga','hidráulica','MÉDIO',105,1.15,1.05,126.00,1.16,146.16,1.6,271.27,105,233.86,40,1.2,1.2),
    ('troca-chuveiro-resistencia','Troca chuveiro/resistência','elétrica','SIMPLES',40,1.15,1.05,48.00,1.16,55.68,1.6,103.34,40,89.09,40,1.2,1.2),
    ('troca-tomadas-interruptores','Troca tomadas/interruptores','elétrica','SIMPLES',40,1.15,1.05,48.00,1.16,55.68,1.6,103.34,40,89.09,40,1.2,1.2),
    ('abertura-de-porta','Abertura de porta','chaveiro','SIMPLES',90,1.15,1.05,108.00,1.16,125.28,3,435.97,90,375.84,40,1.2,1.2),
    ('troca-segredo','Troca segredo','chaveiro','SIMPLES',120,1.15,1.05,144.00,1.16,167.04,3,581.30,120,501.12,40,1.2,1.2),
    ('desentupimento','Desentupimento','hidráulica','MÉDIO',90,1.15,1.05,108.00,1.16,125.28,3,435.97,90,375.84,40,1.2,1.2),
    ('troca-disjuntor','Troca disjuntor','elétrica','MÉDIO',80,1.15,1.05,96.00,1.16,111.36,1.6,206.68,80,178.18,40,1.2,1.2),
    ('instalacao-rede-protecao','Instalação rede proteção','instalação','MÉDIO',100,1.15,1.05,120.00,1.16,139.20,1.4,226.06,100,194.88,40,1.2,1.2),
    ('envelopamento-geladeira-fogao','Envelopamento geladeira/fogão','instalação','SIMPLES',80,1.15,1.05,96.00,1.16,111.36,1.4,180.85,80,155.90,40,1.2,1.2),
    ('instalacao-insulfilm-papel-parede','Instalação insulfilm/papel parede','instalação','SIMPLES',35,1.15,1.05,42.00,1.16,48.72,3,169.55,35,146.16,40,1.2,1.2),
    ('refazer-rejunte','Refazer rejunte (m²)','reparos','SIMPLES',40,1.15,1.05,48.00,1.16,55.68,2.1,135.64,40,116.93,40,1.2,1.2),
    ('troca-registro','Troca de registro com ou sem quebra de parede/revestimento','hidráulica','SIMPLES',130,1.15,1.05,156.00,1.16,180.96,5,1049.57,130,904.80,40,1.2,1.2),
    ('troca-sifao','Troca sifão','hidráulica','SIMPLES',70,1.15,1.05,84.00,1.16,97.44,1.6,180.85,70,155.90,NULL,1.2,1.2),
    ('troca-torneira','Troca torneira','hidráulica','SIMPLES',90,1.15,1.05,108.00,1.16,125.28,1.6,232.52,90,200.45,40,1.2,1.2),
    ('pintura','Pintura (m²)','reparos','SIMPLES',20,1.15,1.05,24.00,1.16,27.84,2.1,67.82,20,58.46,40,1.2,1.2)
)
INSERT INTO public.services_catalog (
  slug, nome, categoria, complexidade,
  custo_profissional, operacao_plataforma_factor, risco_garantia_factor,
  custo_base_real, markup_margem_empresa,
  preco_min, fator_precificacao_maxima, preco_max,
  preco_min_prestador, preco_max_prestador,
  apoio_feminino_valor, urgencia_noturno_factor, domingo_feriado_factor,
  is_fixed_price, comissao_marketplace_pct, ativo, mpq_tabela_rev
)
SELECT
  d.slug, d.nome, d.categoria, d.complexidade,
  d.custo_profissional, d.operacao_plataforma_factor, d.risco_garantia_factor,
  d.custo_base_real, d.markup_margem_empresa,
  d.preco_min, d.fator_precificacao_maxima, d.preco_max,
  d.preco_min_prestador, d.preco_max_prestador,
  d.apoio_feminino_valor, d.urgencia_noturno_factor, d.domingo_feriado_factor,
  false, 15, true, 'rev6'
FROM data d
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  complexidade = EXCLUDED.complexidade,
  custo_profissional = EXCLUDED.custo_profissional,
  operacao_plataforma_factor = EXCLUDED.operacao_plataforma_factor,
  risco_garantia_factor = EXCLUDED.risco_garantia_factor,
  custo_base_real = EXCLUDED.custo_base_real,
  markup_margem_empresa = EXCLUDED.markup_margem_empresa,
  preco_min = EXCLUDED.preco_min,
  preco_max = EXCLUDED.preco_max,
  fator_precificacao_maxima = EXCLUDED.fator_precificacao_maxima,
  preco_min_prestador = EXCLUDED.preco_min_prestador,
  preco_max_prestador = EXCLUDED.preco_max_prestador,
  apoio_feminino_valor = EXCLUDED.apoio_feminino_valor,
  urgencia_noturno_factor = EXCLUDED.urgencia_noturno_factor,
  domingo_feriado_factor = EXCLUDED.domingo_feriado_factor,
  is_fixed_price = false,
  comissao_marketplace_pct = 15,
  ativo = true,
  mpq_tabela_rev = 'rev6';