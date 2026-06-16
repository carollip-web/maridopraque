
-- 1) Remove a policy pública que expunha colunas sensíveis
DROP POLICY IF EXISTS "Public lê catálogo ativo" ON public.services_catalog;

-- 2) Revoga acesso anônimo direto à tabela base
REVOKE SELECT ON public.services_catalog FROM anon;

-- 3) View passa a executar com privilégios do owner (não invocador),
--    permitindo leitura pública somente das colunas seguras sem expor a tabela.
ALTER VIEW public.services_catalog_publico SET (security_invoker = false);

-- 4) Garante acesso de leitura à view para anon e authenticated
GRANT SELECT ON public.services_catalog_publico TO anon, authenticated;
