DROP POLICY IF EXISTS "Admin reads full catalog" ON public.services_catalog;
CREATE POLICY "Admin reads full catalog" ON public.services_catalog
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));