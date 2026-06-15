
GRANT SELECT, INSERT, UPDATE ON public.avaliacoes TO authenticated;
GRANT ALL ON public.avaliacoes TO service_role;

CREATE OR REPLACE VIEW public.avaliacoes_publicas
WITH (security_invoker = on) AS
SELECT
  a.id,
  a.profissional_id,
  a.nota,
  a.comentario,
  a.created_at,
  a.resposta_profissional,
  a.resposta_em,
  COALESCE(p.nome, 'Cliente') AS cliente_nome,
  o.service_name
FROM public.avaliacoes a
LEFT JOIN public.profiles p ON p.id = a.cliente_id
LEFT JOIN public.orcamentos o ON o.id = a.orcamento_id;

GRANT SELECT ON public.avaliacoes_publicas TO anon, authenticated;

DROP POLICY IF EXISTS "Avaliacoes leitura publica via view" ON public.avaliacoes;
CREATE POLICY "Avaliacoes leitura publica via view"
ON public.avaliacoes FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Avaliacoes leitura participantes" ON public.avaliacoes;

DROP POLICY IF EXISTS "Profiles leitura publica nome" ON public.profiles;
-- ensure profiles.nome reachable via view (security_invoker uses caller). 
-- Profiles already has its own policies; view will only return rows the caller can read.
-- To allow anon to see cliente_nome we expose only the nome via the view: it's executed as the
-- caller, so for anon we need a permissive read. Instead, switch view to security_definer-like
-- behavior by recreating it without security_invoker so it runs as the view owner.
