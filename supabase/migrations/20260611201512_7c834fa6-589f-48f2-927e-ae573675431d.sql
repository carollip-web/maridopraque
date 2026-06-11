
-- =========================================================
-- #5: Server-side admin permissions (single source of truth)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_admin_permissions(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
      v_allowed := ARRAY['dashboard','pedidos','profissionais','clientes','servicos','financeiro','config','equipe','notificacoes','leads','apoio_feminino','kpis','disputas','dados'];
      v_readonly := ARRAY[]::text[];
    WHEN 'admin' THEN
      v_allowed := ARRAY['dashboard','pedidos','profissionais','clientes','servicos','financeiro','notificacoes','equipe','leads','apoio_feminino','kpis','disputas','dados'];
      v_readonly := ARRAY[]::text[];
    WHEN 'financeiro' THEN
      v_allowed := ARRAY['dashboard','financeiro','pedidos','notificacoes','disputas','dados'];
      v_readonly := ARRAY['dashboard'];
    WHEN 'suporte' THEN
      v_allowed := ARRAY['dashboard','pedidos','clientes','profissionais','notificacoes','leads','dados'];
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
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_permissions(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.is_admin_section_allowed(_section text, _need_write boolean DEFAULT false, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perms jsonb;
  v_allowed boolean;
  v_readonly boolean;
BEGIN
  v_perms := public.get_admin_permissions(_user_id);
  IF v_perms->>'level' IS NULL THEN RETURN false; END IF;
  v_allowed := (v_perms->'allowed') ? _section;
  IF NOT v_allowed THEN RETURN false; END IF;
  IF _need_write THEN
    v_readonly := (v_perms->'read_only') ? _section;
    IF v_readonly THEN RETURN false; END IF;
  END IF;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_section_allowed(text, boolean, uuid) TO authenticated;

-- =========================================================
-- #7: Remove fanout de notificações em novo pedido pendente
-- (canal realtime de "orcamentos" já notifica profissionais online)
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_orcamento_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'customizado_pendente' AND NEW.status = 'aprovado' AND NEW.auto_aprovado THEN
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
    VALUES (NEW.cliente_id,
      'Orçamento aprovado automaticamente',
      'Seu pedido "' || NEW.service_name || '" foi aprovado. Prossiga para o pagamento.',
      NEW.id, '/cliente?tab=pedidos&pedidoId=' || NEW.id);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'enviado' THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
      VALUES (NEW.cliente_id,
        'Orçamento pronto para sua aprovação',
        'O profissional enviou um orçamento de R$ ' || NEW.valor || ' para "' || NEW.service_name || '".',
        NEW.id, '/cliente?tab=pedidos&pedidoId=' || NEW.id);
    ELSIF NEW.status = 'aprovado' AND NOT NEW.auto_aprovado AND NEW.profissional_id IS NOT NULL THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
      VALUES (NEW.profissional_id,
        'Orçamento aprovado pelo cliente',
        'O cliente aprovou o orçamento de "' || NEW.service_name || '".',
        NEW.id, '/profissional?orcamentoId=' || NEW.id);
    ELSIF NEW.status = 'pago' THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
      VALUES (NEW.profissional_id,
        'Serviço pago e agendado!',
        'O cliente realizou o pagamento para "' || NEW.service_name || '". Confira os detalhes na sua agenda.',
        NEW.id, '/profissional?tab=servicos&orcamentoId=' || NEW.id);
      UPDATE public.profiles SET total_servicos_pagos = total_servicos_pagos + 1 WHERE id = NEW.cliente_id;
    ELSIF NEW.status = 'concluido' THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
      VALUES (NEW.profissional_id,
        'Serviço concluído pelo cliente!',
        'O cliente marcou o serviço "' || NEW.service_name || '" como concluído. O repasse foi liberado para você.',
        NEW.id, '/profissional?tab=servicos&orcamentoId=' || NEW.id);
    ELSIF NEW.status = 'cancelado' AND OLD.status = 'aprovado' THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
      VALUES (NEW.profissional_id,
        'Pedido Cancelado',
        'O pedido "' || NEW.service_name || '" foi cancelado.',
        NEW.id, '/profissional?tab=orcamentos&orcamentoId=' || NEW.id);
    END IF;
  END IF;

  -- INSERT em customizado_pendente: o fanout para N profissionais foi removido.
  -- Os profissionais elegíveis são notificados em tempo real pelo canal
  -- supabase_realtime na tabela `orcamentos` (postgres_changes).

  RETURN NEW;
END;
$function$;

-- Remove o segundo trigger geo-fanout: mesmo motivo (canal realtime cobre)
DROP FUNCTION IF EXISTS public.notify_professionals_new_order() CASCADE;
