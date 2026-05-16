-- Create a function to clear expired temporary reservations
CREATE OR REPLACE FUNCTION public.limpar_reservas_temporarias_expiradas()
RETURNS void AS $$
BEGIN
    -- This deletes temporary blocks that have expired (past their expires_at time)
    -- This frees up the professional's agenda if the client abandoned the checkout
    DELETE FROM public.profissional_bloqueios_agenda
    WHERE status = 'temporario'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if pg_cron is enabled, otherwise log that it needs to be enabled manually
-- For local / lovable, we can just call this from a cron edge function if we want,
-- but pg_cron is standard for Supabase.
-- We won't strictly depend on pg_cron here since Lovable environments might restrict it.
-- Instead, we will rely on checking it dynamically or letting the user trigger it.
