-- P6: revogar EXECUTE de funções SECURITY DEFINER que servem apenas a triggers.
-- Mantém has_role, is_super_admin (usadas em policies RLS) e validar_codigo_indicacao (RPC).
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.handle_new_user()',
    'public.notify_orcamento_change()',
    'public.notify_orcamento_concluido()',
    'public.notify_nova_mensagem()',
    'public.notify_panico()',
    'public.notify_proposta_created()',
    'public.recalcular_orcamento_total()',
    'public.process_new_orcamento()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;