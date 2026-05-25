
-- Helper: adiciona FK só se ainda não existir
DO $$
DECLARE
  r RECORD;
  fks TEXT[][] := ARRAY[
    -- [table, constraint_name, column, ref_table, ref_column, on_delete]
    ['orcamentos','fk_orc_cliente','cliente_id','profiles','id','CASCADE'],
    ['orcamentos','fk_orc_profissional','profissional_id','profiles','id','SET NULL'],
    ['orcamentos','fk_orc_service','service_id','services_catalog','id','SET NULL'],
    ['propostas','fk_prop_orcamento','orcamento_id','orcamentos','id','CASCADE'],
    ['propostas','fk_prop_profissional','profissional_id','profiles','id','CASCADE'],
    ['proposta_materiais','fk_pm_proposta','proposta_id','propostas','id','CASCADE'],
    ['proposta_materiais','fk_pm_material','material_id','materiais','id','CASCADE'],
    ['orcamento_materiais','fk_om_orcamento','orcamento_id','orcamentos','id','CASCADE'],
    ['orcamento_materiais','fk_om_material','material_id','materiais','id','CASCADE'],
    ['service_materiais','fk_sm_service','service_id','services_catalog','id','CASCADE'],
    ['service_materiais','fk_sm_material','material_id','materiais','id','CASCADE'],
    ['pagamentos','fk_pag_orcamento','orcamento_id','orcamentos','id','CASCADE'],
    ['pagamentos','fk_pag_cliente','cliente_id','profiles','id','CASCADE'],
    ['pagamentos','fk_pag_profissional','profissional_id','profiles','id','SET NULL'],
    ['mensagens','fk_msg_orcamento','orcamento_id','orcamentos','id','CASCADE'],
    ['mensagens','fk_msg_remetente','remetente_id','profiles','id','CASCADE'],
    ['mensagens','fk_msg_destinatario','destinatario_id','profiles','id','CASCADE'],
    ['avaliacoes','fk_aval_orcamento','orcamento_id','orcamentos','id','CASCADE'],
    ['avaliacoes','fk_aval_cliente','cliente_id','profiles','id','CASCADE'],
    ['avaliacoes','fk_aval_profissional','profissional_id','profiles','id','SET NULL'],
    ['notificacoes','fk_notif_user','user_id','profiles','id','CASCADE'],
    ['notificacoes','fk_notif_orcamento','orcamento_id','orcamentos','id','SET NULL'],
    ['cliente_enderecos','fk_end_user','user_id','profiles','id','CASCADE'],
    ['cliente_favoritos','fk_fav_cliente','cliente_id','profiles','id','CASCADE'],
    ['cliente_favoritos','fk_fav_profissional','profissional_id','profiles','id','CASCADE'],
    ['profissional_perfil','fk_pp_user','user_id','profiles','id','CASCADE'],
    ['profissional_disponibilidade','fk_pd_user','user_id','profiles','id','CASCADE'],
    ['profissional_bloqueios','fk_pb_user','user_id','profiles','id','CASCADE'],
    ['profissional_bloqueios_agenda','fk_pba_profissional','profissional_id','profiles','id','CASCADE'],
    ['profissional_bloqueios_agenda','fk_pba_orcamento','orcamento_id','orcamentos','id','SET NULL'],
    ['orcamento_recusas','fk_or_orcamento','orcamento_id','orcamentos','id','CASCADE'],
    ['orcamento_recusas','fk_or_profissional','profissional_id','profiles','id','CASCADE'],
    ['repasses_profissionais','fk_rep_profissional','profissional_id','profiles','id','CASCADE'],
    ['repasses_profissionais','fk_rep_cliente','cliente_id','profiles','id','SET NULL'],
    ['repasses_profissionais','fk_rep_orcamento','orcamento_id','orcamentos','id','SET NULL'],
    ['repasses_profissionais','fk_rep_pagamento','pagamento_id','pagamentos','id','SET NULL'],
    ['user_roles','fk_ur_user','user_id','profiles','id','CASCADE'],
    ['panico_eventos','fk_pe_user','user_id','profiles','id','CASCADE'],
    ['panico_eventos','fk_pe_orcamento','orcamento_id','orcamentos','id','SET NULL'],
    ['indicacoes','fk_ind_user','user_id','profiles','id','CASCADE'],
    ['admin_audit_log','fk_aud_actor','actor_user_id','profiles','id','CASCADE'],
    ['admin_audit_log','fk_aud_target','target_user_id','profiles','id','SET NULL'],
    ['suporte_tickets','fk_st_user','user_id','profiles','id','CASCADE']
  ];
  fk TEXT[];
BEGIN
  FOREACH fk SLICE 1 IN ARRAY fks LOOP
    BEGIN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE %s NOT VALID',
        fk[1], fk[2], fk[3], fk[4], fk[5], fk[6]
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN others THEN
        RAISE NOTICE 'Skipped FK %.%: %', fk[1], fk[2], SQLERRM;
    END;
  END LOOP;
END $$;
