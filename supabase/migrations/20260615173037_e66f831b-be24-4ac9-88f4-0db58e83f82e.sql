
-- 1) marketplace_integracoes: ocultar tokens da API
REVOKE ALL ON public.marketplace_integracoes FROM anon, authenticated;
GRANT SELECT (id, provider, account_id, company_id, connected_at, connected_by, scope, token_expires_at, extra, created_at, updated_at),
      INSERT (provider, account_id, company_id, scope, token_expires_at, extra, connected_by, access_token, refresh_token),
      UPDATE (account_id, company_id, scope, token_expires_at, extra, access_token, refresh_token),
      DELETE
  ON public.marketplace_integracoes TO authenticated;
GRANT ALL ON public.marketplace_integracoes TO service_role;

-- 2) profissional_perfil: ocultar tokens MP da API (mesmo para o owner)
DO $$
DECLARE
  v_cols text;
  v_sensitive text[] := ARRAY['mp_access_token','mp_refresh_token','mp_oauth_state','mp_oauth_state_expires_at','mp_public_key'];
BEGIN
  EXECUTE 'REVOKE ALL ON public.profissional_perfil FROM anon, authenticated';

  SELECT string_agg(quote_ident(column_name), ', ')
    INTO v_cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='profissional_perfil'
     AND column_name <> ALL (v_sensitive);

  EXECUTE 'GRANT SELECT (' || v_cols || '), UPDATE (' || v_cols || '), INSERT (' || v_cols || '), DELETE ON public.profissional_perfil TO authenticated';
  EXECUTE 'GRANT SELECT (' || v_cols || ') ON public.profissional_perfil TO anon';
  EXECUTE 'GRANT ALL ON public.profissional_perfil TO service_role';
END$$;

-- 3) notificacoes: remover branch que aceita auth.uid() IS NULL (anon)
DROP POLICY IF EXISTS "Sistema insere notificacoes via definer" ON public.notificacoes;
-- Triggers SECURITY DEFINER são owned por postgres (bypassrls) — inserts internos continuam funcionando.
-- Adicionar política de service_role explícita para edge functions:
CREATE POLICY "Service role insere notificacoes"
  ON public.notificacoes FOR INSERT TO service_role
  WITH CHECK (true);

-- 4) orcamentos: trigger anti self-assign
CREATE OR REPLACE FUNCTION public.prevent_orcamento_assignment_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(v_uid, 'admin'::app_role) THEN RETURN NEW; END IF;

  IF NEW.profissional_id IS DISTINCT FROM OLD.profissional_id THEN
    -- só permitido se a alteração foi feita por SECURITY DEFINER (postgres bypassa este trigger? não — trigger roda também).
    -- bloqueia qualquer alteração direta via REST por não-admin
    RAISE EXCEPTION 'Alteração direta de profissional_id não permitida. Use o fluxo de aceitação de proposta.';
  END IF;
  IF NEW.apoio_profissional_id IS DISTINCT FROM OLD.apoio_profissional_id THEN
    RAISE EXCEPTION 'Alteração direta de apoio_profissional_id não permitida. Use o fluxo de assumir vaga.';
  END IF;
  RETURN NEW;
END$$;

REVOKE EXECUTE ON FUNCTION public.prevent_orcamento_assignment_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_orcamento_assignment_escalation ON public.orcamentos;
CREATE TRIGGER trg_prevent_orcamento_assignment_escalation
  BEFORE UPDATE OF profissional_id, apoio_profissional_id ON public.orcamentos
  FOR EACH ROW
  WHEN (current_setting('role', true) NOT IN ('service_role'))
  EXECUTE FUNCTION public.prevent_orcamento_assignment_escalation();

-- Os RPCs SECURITY DEFINER aceitar_proposta_cliente e assumir_vaga_apoio_feminino
-- executam como owner (postgres, bypassrls) — auth.uid() ainda retorna o user mas
-- has_role(...,'admin') é falso. Precisamos isentar essas funções: usar SET LOCAL.
-- Mais simples: assumir_vaga e aceitar_proposta setam um GUC que o trigger lê.

CREATE OR REPLACE FUNCTION public.aceitar_proposta_cliente(_proposta_id uuid)
 RETURNS TABLE(ok boolean, orcamento_id uuid, proposta_id uuid, agenda_reserva uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prop public.propostas%ROWTYPE;
  v_orc public.orcamentos%ROWTYPE;
  v_reserva_id uuid;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_dur int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_prop FROM public.propostas p WHERE p.id = _proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;

  SELECT * INTO v_orc FROM public.orcamentos o WHERE o.id = v_prop.orcamento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;

  IF v_orc.cliente_id <> v_uid THEN
    RAISE EXCEPTION 'Você não tem permissão para aprovar esta proposta';
  END IF;

  IF v_orc.status::text NOT IN ('customizado_pendente','enviado') THEN
    RAISE EXCEPTION 'Este orçamento não pode mais receber aprovações (status: %)', v_orc.status;
  END IF;

  UPDATE public.propostas p SET status = 'aceita', updated_at = now() WHERE p.id = _proposta_id;
  UPDATE public.propostas p
     SET status = 'recusada', updated_at = now()
   WHERE p.orcamento_id = v_prop.orcamento_id AND p.id <> _proposta_id;

  -- Marca este escopo como assinatura interna autorizada
  PERFORM set_config('app.allow_orcamento_assignment','1', true);

  UPDATE public.orcamentos o
     SET profissional_id = v_prop.profissional_id,
         valor_servico = v_prop.valor_servico,
         valor = COALESCE(v_prop.valor_servico,0) + COALESCE(o.taxa_material,0),
         status = 'aprovado',
         data_aprovacao = now(),
         updated_at = now()
   WHERE o.id = v_prop.orcamento_id;

  IF v_orc.data_preferida IS NOT NULL THEN
    SELECT COALESCE(pp.duracao_padrao_min, 60) INTO v_dur
      FROM public.profissional_perfil pp WHERE pp.user_id = v_prop.profissional_id;
    v_inicio := (v_orc.data_preferida::timestamp + COALESCE(v_orc.horario_preferido, time '09:00')) AT TIME ZONE 'America/Sao_Paulo';
    v_fim := v_inicio + make_interval(mins => COALESCE(v_dur,60));

    INSERT INTO public.profissional_bloqueios_agenda
      (profissional_id, orcamento_id, inicio, fim, status, motivo, expires_at)
    VALUES
      (v_prop.profissional_id, v_prop.orcamento_id, v_inicio, v_fim, 'temporario',
       'Reserva aguardando pagamento', now() + interval '30 minutes')
    RETURNING id INTO v_reserva_id;
  END IF;

  ok := true;
  orcamento_id := v_prop.orcamento_id;
  proposta_id := _proposta_id;
  agenda_reserva := v_reserva_id;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assumir_vaga_apoio_feminino(_orcamento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perfil RECORD;
  v_orc RECORD;
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.has_role(v_uid, 'profissional') THEN
    RAISE EXCEPTION 'Apenas profissionais podem assumir vagas de apoio';
  END IF;

  SELECT genero, oferece_apoio_feminino, ativo, aprovacao_status
    INTO v_perfil
    FROM public.profissional_perfil
   WHERE user_id = v_uid;

  IF NOT FOUND
     OR v_perfil.ativo IS NOT TRUE
     OR v_perfil.aprovacao_status <> 'aprovado'
     OR v_perfil.genero <> 'mulher'
     OR v_perfil.oferece_apoio_feminino IS NOT TRUE THEN
    RAISE EXCEPTION 'Perfil incompatível para vaga de apoio feminino';
  END IF;

  SELECT id, apoio_profissional_id, tipo_atendimento
    INTO v_orc
    FROM public.orcamentos
   WHERE id = _orcamento_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_orc.tipo_atendimento <> 'homem_com_apoio_feminino' THEN
    RAISE EXCEPTION 'Pedido não requer apoio feminino';
  END IF;
  IF v_orc.apoio_profissional_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Vaga já preenchida');
  END IF;

  PERFORM set_config('app.allow_orcamento_assignment','1', true);

  UPDATE public.orcamentos
     SET apoio_profissional_id = v_uid,
         status_apoio = 'confirmado',
         updated_at = now()
   WHERE id = _orcamento_id
     AND apoio_profissional_id IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Vaga já preenchida');
  END IF;

  RETURN jsonb_build_object('ok', true);
END
$function$;

-- Recriar o trigger lendo o GUC
CREATE OR REPLACE FUNCTION public.prevent_orcamento_assignment_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed text := current_setting('app.allow_orcamento_assignment', true);
BEGIN
  IF v_allowed = '1' THEN RETURN NEW; END IF;
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(v_uid, 'admin'::app_role) THEN RETURN NEW; END IF;

  IF NEW.profissional_id IS DISTINCT FROM OLD.profissional_id THEN
    RAISE EXCEPTION 'Alteração direta de profissional_id não permitida.';
  END IF;
  IF NEW.apoio_profissional_id IS DISTINCT FROM OLD.apoio_profissional_id THEN
    RAISE EXCEPTION 'Alteração direta de apoio_profissional_id não permitida.';
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_prevent_orcamento_assignment_escalation ON public.orcamentos;
CREATE TRIGGER trg_prevent_orcamento_assignment_escalation
  BEFORE UPDATE OF profissional_id, apoio_profissional_id ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_orcamento_assignment_escalation();

-- 5) documentos-profissionais: DELETE policy
CREATE POLICY "Profissional deleta proprio doc"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documentos-profissionais'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 6) materiais: restringir a usuários autenticados
DROP POLICY IF EXISTS "Materiais public read" ON public.materiais;
CREATE POLICY "Materiais leitura autenticada"
  ON public.materiais FOR SELECT
  TO authenticated
  USING (true);

-- 7) avaliacoes: esconder cliente_id de anon via column grants
REVOKE ALL ON public.avaliacoes FROM anon;
GRANT SELECT (id, orcamento_id, profissional_id, nota, comentario, resposta_profissional, resposta_em, created_at)
  ON public.avaliacoes TO anon;
-- authenticated mantém acesso total (necessário para o cliente ver as próprias avaliações)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes TO authenticated;
GRANT ALL ON public.avaliacoes TO service_role;
