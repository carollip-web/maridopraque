
-- 1) search_path
ALTER FUNCTION public.notificar_avaliacao_pos_conclusao() SET search_path = public;
ALTER FUNCTION public.notificar_profissional_nova_avaliacao() SET search_path = public;
ALTER FUNCTION public.notify_professionals_new_order() SET search_path = public;

-- 2) Move pg_net out of public (recreate; no app code depends on its objects)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, authenticated, service_role, anon;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net SCHEMA extensions;

-- 3) Tighten lead capture policy
DROP POLICY IF EXISTS "Allow public insert to profissionais_pre_cadastro" ON public.profissionais_pre_cadastro;
CREATE POLICY "Lead capture insert" ON public.profissionais_pre_cadastro
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'novo'
    AND nome IS NOT NULL AND length(btrim(nome)) BETWEEN 2 AND 120
    AND telefone IS NOT NULL AND length(btrim(telefone)) BETWEEN 8 AND 30
    AND cidade IS NOT NULL AND length(btrim(cidade)) BETWEEN 2 AND 120
    AND especialidade_principal IS NOT NULL AND length(btrim(especialidade_principal)) BETWEEN 2 AND 120
    AND user_id IS NULL
  );

-- 4) Lock down SECURITY DEFINER functions
DO $$
DECLARE fn text;
DECLARE system_fns text[] := ARRAY[
  'auto_concluir_orcamentos_vencidos()',
  'criar_repasse_profissional_pendente(uuid)',
  'criar_split_pagamento(uuid)',
  'handle_avaliacao_resposta_notificacao()',
  'handle_new_user()',
  'liberar_splits_vencidos()',
  'limpar_reservas_temporarias_expiradas()',
  'notificar_avaliacao_pos_conclusao()',
  'notificar_profissional_nova_avaliacao()',
  'notify_bloqueio_agenda_status()',
  'notify_nova_mensagem()',
  'notify_orcamento_change()',
  'notify_orcamento_concluido()',
  'notify_panico()',
  'notify_professionals_new_order()',
  'notify_profissional_approval()',
  'notify_proposta_created()',
  'notify_proposta_recusada()',
  'process_new_orcamento()',
  'processar_saque_pago(uuid)',
  'recalcular_orcamento_total()',
  'recalcular_orcamento_total_self()',
  'recalcular_saldos_profissional(uuid)',
  'resolver_disputa_orcamento(uuid,numeric,numeric,text)',
  'trg_orcamento_concluido_libera_split()',
  'trg_orcamento_sync_agenda()',
  'trg_pagamento_paid_cria_split()',
  'trg_pagamento_splits_atualiza_saldo()',
  'handle_updated_at()',
  'set_updated_at()'
];
DECLARE rpc_fns text[] := ARRAY[
  'abrir_disputa_orcamento(uuid,text)',
  'aceitar_proposta_cliente(uuid)',
  'assumir_vaga_apoio_feminino(uuid)',
  'cancelar_orcamento_com_split(uuid,text,text)',
  'confirmar_convite(uuid)',
  'marcar_orcamento_enviado(uuid)',
  'verificar_convite(uuid)',
  'validar_codigo_indicacao(text)'
];
DECLARE helper_fns text[] := ARRAY[
  'has_role(uuid,app_role)',
  'is_admin_section_allowed(text,boolean,uuid)',
  'is_super_admin(uuid)',
  'get_admin_permissions(uuid)'
];
BEGIN
  FOREACH fn IN ARRAY system_fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
    EXCEPTION WHEN undefined_function THEN NULL; END;
  END LOOP;
  FOREACH fn IN ARRAY rpc_fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn);
    EXCEPTION WHEN undefined_function THEN NULL; END;
  END LOOP;
  FOREACH fn IN ARRAY helper_fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated, service_role', fn);
    EXCEPTION WHEN undefined_function THEN NULL; END;
  END LOOP;
END $$;

-- 5) Storage policies for now-private orcamento-fotos bucket
DROP POLICY IF EXISTS "Orcamento fotos public read" ON storage.objects;
DROP POLICY IF EXISTS "Orcamento fotos auth read" ON storage.objects;
DROP POLICY IF EXISTS "Orcamento fotos owner write" ON storage.objects;
DROP POLICY IF EXISTS "Orcamento fotos owner update" ON storage.objects;
DROP POLICY IF EXISTS "Orcamento fotos owner delete" ON storage.objects;

CREATE POLICY "Orcamento fotos auth read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'orcamento-fotos'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.orcamentos o
         WHERE (auth.uid() = o.cliente_id
                OR auth.uid() = o.profissional_id
                OR auth.uid() = o.apoio_profissional_id)
           AND (
             EXISTS (
               SELECT 1 FROM unnest(COALESCE(o.fotos_problema, ARRAY[]::text[])) AS u
               WHERE u LIKE '%/orcamento-fotos/' || name OR u = name
             )
             OR EXISTS (
               SELECT 1 FROM unnest(COALESCE(o.fotos_concluido, ARRAY[]::text[])) AS u
               WHERE u LIKE '%/orcamento-fotos/' || name OR u = name
             )
           )
      )
    )
  );

CREATE POLICY "Orcamento fotos owner write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'orcamento-fotos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Orcamento fotos owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'orcamento-fotos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Orcamento fotos owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'orcamento-fotos'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );
