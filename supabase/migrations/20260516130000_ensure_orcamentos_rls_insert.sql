-- Migration idempotente: garante RLS + policy de INSERT em public.orcamentos
-- Objetivo: qualquer cliente autenticado pode criar orçamento com cliente_id = auth.uid()

-- 1. Garante RLS habilitado
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- 2. Remove e recria a policy de INSERT de forma idempotente
DROP POLICY IF EXISTS "Cliente cria orçamento" ON public.orcamentos;

CREATE POLICY "Cliente cria orçamento"
  ON public.orcamentos
  FOR INSERT
  WITH CHECK (auth.uid() = cliente_id);

-- 3. Garante que a policy de SELECT também existe (leitura do próprio registro após insert)
DROP POLICY IF EXISTS "Cliente vê próprios orçamentos" ON public.orcamentos;

CREATE POLICY "Cliente vê próprios orçamentos"
  ON public.orcamentos
  FOR SELECT
  USING (
    auth.uid() = cliente_id
    OR auth.uid() = profissional_id
    OR public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'profissional') AND profissional_id IS NULL)
  );

-- 4. Garante UPDATE policy
DROP POLICY IF EXISTS "Cliente/profissional/admin atualizam" ON public.orcamentos;

CREATE POLICY "Cliente/profissional/admin atualizam"
  ON public.orcamentos
  FOR UPDATE
  USING (
    auth.uid() = cliente_id
    OR auth.uid() = profissional_id
    OR public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'profissional') AND profissional_id IS NULL)
  );
