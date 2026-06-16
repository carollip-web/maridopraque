DROP POLICY IF EXISTS "Admins manage catalog" ON public.services_catalog;
CREATE POLICY "Admins manage catalog" ON public.services_catalog
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));