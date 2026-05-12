-- 1. Avaliacoes: restringir leitura
DROP POLICY IF EXISTS "Avaliacoes leitura autenticados" ON public.avaliacoes;
CREATE POLICY "Avaliacoes leitura participantes"
ON public.avaliacoes FOR SELECT
TO authenticated
USING (
  auth.uid() = cliente_id
  OR auth.uid() = profissional_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2. Profissional_bloqueios: restringir leitura
DROP POLICY IF EXISTS "Bloqueios leitura autenticados" ON public.profissional_bloqueios;
-- (As policies "Profissional gerencia proprios bloqueios" e "Admin gerencia bloqueios" já cobrem SELECT via FOR ALL)

-- 3. Realtime: autorização por tópico
-- Convenção: clientes/profissionais devem usar topic = user_id ou orcamento:<id>
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can subscribe to own topics" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe to own topics"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  -- topic é o próprio user_id
  realtime.topic() = auth.uid()::text
  OR
  -- topic é "orcamento:<uuid>" e usuário participa do orçamento
  (
    realtime.topic() LIKE 'orcamento:%'
    AND EXISTS (
      SELECT 1 FROM public.orcamentos o
      WHERE o.id::text = substring(realtime.topic() from 11)
        AND (o.cliente_id = auth.uid() OR o.profissional_id = auth.uid())
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Authenticated can broadcast to own topics" ON realtime.messages;
CREATE POLICY "Authenticated can broadcast to own topics"
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = auth.uid()::text
  OR (
    realtime.topic() LIKE 'orcamento:%'
    AND EXISTS (
      SELECT 1 FROM public.orcamentos o
      WHERE o.id::text = substring(realtime.topic() from 11)
        AND (o.cliente_id = auth.uid() OR o.profissional_id = auth.uid())
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);