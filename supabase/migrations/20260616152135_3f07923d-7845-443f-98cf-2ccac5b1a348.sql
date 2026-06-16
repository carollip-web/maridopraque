
-- 1) avaliacoes: restringir SELECT a authenticated; view pública cobre anon
DROP POLICY IF EXISTS "Avaliacoes leitura publica via view" ON public.avaliacoes;
DROP POLICY IF EXISTS "Avaliacoes leitura publica" ON public.avaliacoes;

CREATE POLICY "Avaliacoes leitura autenticada"
ON public.avaliacoes
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.avaliacoes FROM anon;
GRANT SELECT ON public.avaliacoes_publicas TO anon, authenticated;

-- 2) apoio_feminino_equipe: policy SELECT explícita só admin
CREATE POLICY "Admin le equipe apoio"
ON public.apoio_feminino_equipe
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) orcamentos: estender trigger para bloquear field-level escalation
CREATE OR REPLACE FUNCTION public.prevent_orcamento_assignment_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed text := current_setting('app.allow_orcamento_assignment', true);
BEGIN
  -- Fluxo interno autorizado (RPCs SECURITY DEFINER) pode tudo
  IF v_allowed = '1' THEN RETURN NEW; END IF;
  -- Service role / chamadas sem auth (edge functions com admin client) podem tudo
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  -- Admin pode tudo
  IF public.has_role(v_uid, 'admin'::app_role) THEN RETURN NEW; END IF;

  -- Bloqueios já existentes
  IF NEW.profissional_id IS DISTINCT FROM OLD.profissional_id THEN
    RAISE EXCEPTION 'Alteração direta de profissional_id não permitida.';
  END IF;
  IF NEW.apoio_profissional_id IS DISTINCT FROM OLD.apoio_profissional_id THEN
    RAISE EXCEPTION 'Alteração direta de apoio_profissional_id não permitida.';
  END IF;

  -- Novos bloqueios de campos financeiros / de status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Alteração direta de status não permitida — use os fluxos apropriados.';
  END IF;
  IF NEW.valor IS DISTINCT FROM OLD.valor THEN
    RAISE EXCEPTION 'Alteração direta de valor não permitida.';
  END IF;
  IF NEW.valor_servico IS DISTINCT FROM OLD.valor_servico THEN
    RAISE EXCEPTION 'Alteração direta de valor_servico não permitida.';
  END IF;
  IF NEW.taxa_material IS DISTINCT FROM OLD.taxa_material THEN
    RAISE EXCEPTION 'Alteração direta de taxa_material não permitida.';
  END IF;
  IF NEW.is_test IS DISTINCT FROM OLD.is_test THEN
    RAISE EXCEPTION 'Alteração direta de is_test não permitida.';
  END IF;
  IF NEW.data_aprovacao IS DISTINCT FROM OLD.data_aprovacao THEN
    RAISE EXCEPTION 'Alteração direta de data_aprovacao não permitida.';
  END IF;
  IF NEW.auto_aprovado IS DISTINCT FROM OLD.auto_aprovado THEN
    RAISE EXCEPTION 'Alteração direta de auto_aprovado não permitida.';
  END IF;

  RETURN NEW;
END;
$$;
