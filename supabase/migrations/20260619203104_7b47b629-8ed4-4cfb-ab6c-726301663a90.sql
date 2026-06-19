-- Remove cron antigo (URL via current_setting retornava NULL fora de request)
SELECT cron.unschedule('cron-verificar-autorizacoes-diario')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cron-verificar-autorizacoes-diario');

-- Recria com URL hardcoded, seguindo o mesmo padrão do cron 'retentar-estornos-diario'
SELECT cron.schedule(
  'cron-verificar-autorizacoes-diario',
  '0 11 * * *', -- 08:00 BRT (UTC-3)
  $$
    SELECT net.http_post(
      url := 'https://rbfonmpuepqfhivvoqku.supabase.co/functions/v1/cron-verificar-autorizacoes',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', current_setting('app.settings.cron_secret', true)),
      body := '{}'::jsonb
    );
  $$
);