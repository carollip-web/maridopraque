
-- ============ avaliacoes ============
DROP POLICY IF EXISTS "Avaliacoes leitura autenticada" ON public.avaliacoes;

CREATE POLICY "Cliente le proprias avaliacoes"
ON public.avaliacoes FOR SELECT TO authenticated
USING (auth.uid() = cliente_id);

CREATE POLICY "Profissional le avaliacoes recebidas"
ON public.avaliacoes FOR SELECT TO authenticated
USING (auth.uid() = profissional_id);

CREATE POLICY "Admin le todas avaliacoes"
ON public.avaliacoes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ marketplace_integracoes ============
-- Restringe acesso a super_admin apenas (era super_admin + financeiro). Tokens OAuth ficam fora do alcance de RLS regular.
DROP POLICY IF EXISTS "Admins elevados controlam integracoes" ON public.marketplace_integracoes;

CREATE POLICY "Apenas super_admin acessa integracoes"
ON public.marketplace_integracoes FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::app_role
      AND (ur.admin_level)::text = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::app_role
      AND (ur.admin_level)::text = 'super_admin'
  )
);

-- Revoga leitura de tokens OAuth via API (apenas service_role pode ler)
REVOKE SELECT (access_token, refresh_token) ON public.marketplace_integracoes FROM authenticated, anon;

-- ============ profissional_perfil: ocultar tokens OAuth de qualquer leitura via RLS ============
REVOKE SELECT (mp_access_token, mp_refresh_token) ON public.profissional_perfil FROM authenticated, anon;

-- ============ orcamentos: trigger amplia mascaramento quando pedido não tem profissional ============
CREATE OR REPLACE FUNCTION public.enforce_endereco_snapshot_only_when_assigned()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.profissional_id IS NULL THEN
    NEW.endereco_snapshot := NULL;
    NEW.fotos_problema := NULL;
    NEW.fotos_concluido := NULL;
    NEW.checkin_lat := NULL;
    NEW.checkin_lng := NULL;
    NEW.checkout_lat := NULL;
    NEW.checkout_lng := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- ============ realtime.messages: incluir apoio_profissional_id ============
DROP POLICY IF EXISTS "Authenticated can subscribe to own topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can broadcast to own topics" ON realtime.messages;

CREATE POLICY "Authenticated can subscribe to own topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  (realtime.topic() = (auth.uid())::text)
  OR (
    realtime.topic() LIKE 'orcamento:%'
    AND EXISTS (
      SELECT 1 FROM public.orcamentos o
      WHERE (o.id)::text = SUBSTRING(realtime.topic() FROM 11)
        AND (
          o.cliente_id = auth.uid()
          OR o.profissional_id = auth.uid()
          OR o.apoio_profissional_id = auth.uid()
        )
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Authenticated can broadcast to own topics"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  (realtime.topic() = (auth.uid())::text)
  OR (
    realtime.topic() LIKE 'orcamento:%'
    AND EXISTS (
      SELECT 1 FROM public.orcamentos o
      WHERE (o.id)::text = SUBSTRING(realtime.topic() FROM 11)
        AND (
          o.cliente_id = auth.uid()
          OR o.profissional_id = auth.uid()
          OR o.apoio_profissional_id = auth.uid()
        )
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- ============ storage: avatars (público por design — política explícita) ============
DROP POLICY IF EXISTS "Avatars publicos leitura" ON storage.objects;
CREATE POLICY "Avatars publicos leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- ============ storage: documentos-profissionais (exige perfil profissional) ============
DROP POLICY IF EXISTS "Profissional ve proprio doc" ON storage.objects;
CREATE POLICY "Profissional ve proprio doc"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos-profissionais'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.profissional_perfil pp
    WHERE pp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Profissional upload proprio doc" ON storage.objects;
CREATE POLICY "Profissional upload proprio doc"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos-profissionais'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.profissional_perfil pp
    WHERE pp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Docs profissionais auth upload" ON storage.objects;
DROP POLICY IF EXISTS "Docs profissionais auth update" ON storage.objects;
