SELECT cron.schedule(
  'cron-verificar-autorizacoes-diario',
  '0 11 * * *', -- 8h no horário de Brasília (UTC-3)
  $$
    select net.http_post(
        url:='https://' || current_setting('request.jwt.claim.iss', true) || '/functions/v1/cron-verificar-autorizacoes',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.jwt.claim.role', true) || '"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
