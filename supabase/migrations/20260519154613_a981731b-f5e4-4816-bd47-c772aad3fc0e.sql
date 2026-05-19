CREATE OR REPLACE FUNCTION public.limpar_reservas_temporarias_expiradas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.profissional_bloqueios_agenda
  WHERE status = 'temporario'
    AND expires_at IS NOT NULL
    AND expires_at < now();
END;
$$;