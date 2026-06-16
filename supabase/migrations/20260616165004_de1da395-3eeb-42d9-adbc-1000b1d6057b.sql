GRANT SELECT ON public.services_catalog TO anon;

CREATE POLICY "Public lê catálogo ativo"
  ON public.services_catalog
  FOR SELECT
  TO anon, authenticated
  USING (ativo = true);