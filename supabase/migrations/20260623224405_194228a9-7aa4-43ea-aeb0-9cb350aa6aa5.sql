
UPDATE public.pagamentos
   SET status_autorizacao = 'capturado',
       capturado_em = now()
 WHERE id = 'bb4d7446-c871-4a02-a76c-34a78ec61b23';

UPDATE public.orcamentos
   SET status = 'concluido', updated_at = now()
 WHERE id = '3da7cfc6-ea1b-453c-8672-461fd5fb10dc';
