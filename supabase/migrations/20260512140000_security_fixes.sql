
-- 1. Profiles RLS Fix
-- Restringir profissionais para verem apenas perfis de clientes vinculados a seus pedidos
DROP POLICY IF EXISTS "Profiles viewable by self or admin/professional" ON public.profiles;

CREATE POLICY "Profiles viewable by self or admin" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id 
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Profiles viewable by linked professional" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orcamentos 
      WHERE orcamentos.cliente_id = profiles.id 
      AND (
        orcamentos.profissional_id = auth.uid()
        OR (orcamentos.status = 'customizado_pendente' AND public.has_role(auth.uid(), 'profissional'))
      )
    )
  );

-- 2. Indicacoes RLS Fix
-- Remover acesso direto de leitura pública e substituir por RPC segura
DROP POLICY IF EXISTS "Codigo publico para validar" ON public.indicacoes;

CREATE OR REPLACE FUNCTION public.validar_codigo_indicacao(p_codigo text)
RETURNS TABLE (desconto_percent integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT i.desconto_percent
  FROM public.indicacoes i
  WHERE i.codigo = p_codigo;
END;
$$;

-- 3. Professional Privacy Fixes (Warnings)
-- Bloqueios e disponibilidade não devem ser 100% públicos
DROP POLICY IF EXISTS "Bloqueios leitura publica" ON public.profissional_bloqueios;
CREATE POLICY "Bloqueios visiveis para autenticados" ON public.profissional_bloqueios 
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Disponibilidade leitura publica" ON public.profissional_disponibilidade;
CREATE POLICY "Disponibilidade visivel para autenticados" ON public.profissional_disponibilidade 
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 4. Security for Realtime
-- Garantir que tabelas de Realtime (notificacoes, mensagens) usem RLS rigoroso (já estão habilitadas, mas reforçamos)
-- Notificações: apenas o próprio usuário vê
DROP POLICY IF EXISTS "Usuário vê próprias notificações" ON public.notificacoes;
CREATE POLICY "Usuário vê próprias notificações" ON public.notificacoes
  FOR SELECT USING (auth.uid() = user_id);

-- Mensagens: apenas participantes leem (já configurado corretamente na migration original)
