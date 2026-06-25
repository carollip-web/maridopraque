CREATE OR REPLACE FUNCTION public.get_admin_permissions(_user_id uuid DEFAULT auth.uid())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_level text;
  v_allowed text[];
  v_readonly text[];
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('level', NULL, 'allowed', '[]'::jsonb, 'read_only', '[]'::jsonb);
  END IF;

  SELECT admin_level::text INTO v_level
    FROM public.user_roles
   WHERE user_id = _user_id AND role = 'admin'
   LIMIT 1;

  IF v_level IS NULL THEN
    RETURN jsonb_build_object('level', NULL, 'allowed', '[]'::jsonb, 'read_only', '[]'::jsonb);
  END IF;

  CASE v_level
    WHEN 'super_admin' THEN
      v_allowed := ARRAY['dashboard','pedidos','profissionais','clientes','servicos','financeiro','config','equipe','notificacoes','emails','leads','apoio_feminino','kpis','disputas','dados','suporte'];
      v_readonly := ARRAY[]::text[];
    WHEN 'admin' THEN
      v_allowed := ARRAY['dashboard','pedidos','profissionais','clientes','servicos','financeiro','notificacoes','emails','equipe','leads','apoio_feminino','kpis','disputas','dados','suporte'];
      v_readonly := ARRAY[]::text[];
    WHEN 'financeiro' THEN
      v_allowed := ARRAY['dashboard','financeiro','pedidos','notificacoes','disputas','dados'];
      v_readonly := ARRAY['dashboard'];
    WHEN 'suporte' THEN
      v_allowed := ARRAY['dashboard','pedidos','clientes','profissionais','notificacoes','leads','dados','suporte'];
      v_readonly := ARRAY['pedidos','clientes'];
    ELSE
      v_allowed := ARRAY[]::text[];
      v_readonly := ARRAY[]::text[];
  END CASE;

  RETURN jsonb_build_object(
    'level', v_level,
    'allowed', to_jsonb(v_allowed),
    'read_only', to_jsonb(v_readonly)
  );
END;
$function$;