
-- Extensões necessárias para o cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1) Coluna para registrar reembolsos/multa por pagamento
ALTER TABLE public.pagamento_splits
  ADD COLUMN IF NOT EXISTS valor_reembolso numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;

-- 2) Função que aplica regra de split parcial ao cancelar um orçamento
CREATE OR REPLACE FUNCTION public.cancelar_orcamento_com_split(
  _orcamento_id uuid,
  _motivo text DEFAULT NULL,
  _origem text DEFAULT 'cliente'   -- 'cliente' | 'prestador' | 'admin' | 'sistema'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_orc public.orcamentos%ROWTYPE;
  v_pag public.pagamentos%ROWTYPE;
  v_split public.pagamento_splits%ROWTYPE;
  v_cfg public.financeiro_config%ROWTYPE;
  v_horario timestamptz;
  v_horas_para_inicio numeric;
  v_pct_prof numeric := 0;          -- % do valor_total que o prestador recebe
  v_pct_plataforma numeric := 0;    -- % da plataforma (taxa)
  v_pct_reembolso numeric := 100;   -- % devolvido ao cliente
  v_valor_total numeric;
  v_valor_prof numeric;
  v_valor_plat numeric;
  v_valor_reemb numeric;
  v_regra text;
BEGIN
  SELECT * INTO v_orc FROM public.orcamentos WHERE id = _orcamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento % não encontrado', _orcamento_id; END IF;
  IF v_orc.status::text IN ('cancelado','concluido','em_disputa') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Orçamento já está em status final: ' || v_orc.status);
  END IF;

  -- Carrega pagamento (se houver) e split
  SELECT * INTO v_pag FROM public.pagamentos
    WHERE orcamento_id = _orcamento_id AND status = 'paid' ORDER BY paid_at DESC NULLS LAST LIMIT 1;
  SELECT * INTO v_split FROM public.pagamento_splits
    WHERE orcamento_id = _orcamento_id ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO v_cfg FROM public.financeiro_config WHERE id = true;

  -- Horário previsto do serviço
  IF v_orc.data_preferida IS NOT NULL THEN
    v_horario := (v_orc.data_preferida::timestamp + COALESCE(v_orc.horario_preferido, time '09:00'))
                 AT TIME ZONE 'America/Sao_Paulo';
    v_horas_para_inicio := EXTRACT(EPOCH FROM (v_horario - now())) / 3600.0;
  END IF;

  -- ===== Regras =====
  IF v_orc.checkin_em IS NOT NULL AND v_orc.checkout_em IS NULL THEN
    -- Prestador chegou mas não finalizou → 50/50
    v_pct_prof := 50;
    v_pct_plataforma := COALESCE(v_cfg.taxa_plataforma_percent, 15) * 0.5;
    v_pct_reembolso := 100 - v_pct_prof - v_pct_plataforma;
    v_regra := 'checkin_sem_conclusao_50_50';
  ELSIF _origem = 'cliente' AND v_horario IS NOT NULL AND v_horas_para_inicio < 2 THEN
    -- Cliente cancelou com < 2h → multa 20% (15% prestador + 5% plataforma) / 80% reembolso
    v_pct_prof := 15;
    v_pct_plataforma := 5;
    v_pct_reembolso := 80;
    v_regra := 'cliente_cancelou_menos_2h';
  ELSE
    -- Antes do check-in / >2h / cancelamento sem checkin → reembolso total
    v_pct_prof := 0;
    v_pct_plataforma := 0;
    v_pct_reembolso := 100;
    v_regra := 'reembolso_integral';
  END IF;

  -- ===== Aplica nos splits (se houver pagamento) =====
  IF v_pag.id IS NOT NULL AND v_split.id IS NOT NULL THEN
    v_valor_total := COALESCE(v_pag.valor_total, 0);
    v_valor_prof := ROUND((v_valor_total * v_pct_prof / 100.0)::numeric, 2);
    v_valor_plat := ROUND((v_valor_total * v_pct_plataforma / 100.0)::numeric, 2);
    v_valor_reemb := v_valor_total - v_valor_prof - v_valor_plat;

    UPDATE public.pagamento_splits
       SET valor_profissional = v_valor_prof,
           taxa_plataforma = v_valor_plat,
           valor_reembolso = v_valor_reemb,
           status = CASE WHEN v_valor_prof > 0 THEN 'disponivel' ELSE 'retido' END,
           disponivel_em = CASE WHEN v_valor_prof > 0 THEN now() ELSE disponivel_em END,
           motivo_cancelamento = v_regra,
           updated_at = now()
     WHERE id = v_split.id;
  END IF;

  -- ===== Atualiza orçamento e agenda =====
  UPDATE public.orcamentos
     SET status = 'cancelado',
         observacoes_profissional = COALESCE(_motivo, observacoes_profissional),
         updated_at = now()
   WHERE id = _orcamento_id;

  UPDATE public.profissional_bloqueios_agenda
     SET status = 'cancelado', expires_at = now(), updated_at = now()
   WHERE orcamento_id = _orcamento_id AND status IN ('temporario','confirmado');

  -- Notifica cliente sobre o resultado financeiro
  IF v_pag.id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
    VALUES (
      v_orc.cliente_id,
      CASE WHEN v_pct_reembolso = 100 THEN 'Cancelamento confirmado — reembolso integral'
           WHEN v_pct_reembolso = 0   THEN 'Cancelamento confirmado — sem reembolso'
           ELSE 'Cancelamento confirmado — reembolso parcial' END,
      'Regra aplicada: ' || v_regra || '. Reembolso: R$ ' ||
        ROUND((COALESCE(v_pag.valor_total,0) * v_pct_reembolso / 100.0)::numeric, 2) || '.',
      _orcamento_id,
      '/cliente?tab=pedidos&pedidoId=' || _orcamento_id
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'regra', v_regra,
    'pct_prestador', v_pct_prof,
    'pct_plataforma', v_pct_plataforma,
    'pct_reembolso', v_pct_reembolso
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancelar_orcamento_com_split(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_orcamento_com_split(uuid, text, text) TO authenticated, service_role;

-- 3) Função que abre disputa (admin manual depois)
CREATE OR REPLACE FUNCTION public.abrir_disputa_orcamento(_orcamento_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_cliente uuid;
BEGIN
  UPDATE public.orcamentos
     SET status = 'em_disputa', observacoes_profissional = _motivo, updated_at = now()
   WHERE id = _orcamento_id
   RETURNING cliente_id INTO v_cliente;

  INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
  SELECT ur.user_id,
    '⚠️ Disputa aberta',
    'Pedido em disputa precisa de decisão manual. Motivo: ' || _motivo,
    _orcamento_id,
    '/admin?tab=disputas&pedidoId=' || _orcamento_id
  FROM public.user_roles ur WHERE ur.role = 'admin';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.abrir_disputa_orcamento(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.abrir_disputa_orcamento(uuid, text) TO authenticated, service_role;

-- 4) Auto-conclusão: 3 dias após check-out sem o cliente confirmar
CREATE OR REPLACE FUNCTION public.auto_concluir_orcamentos_vencidos()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_row record;
BEGIN
  FOR v_row IN
    SELECT id, cliente_id, profissional_id, service_name
      FROM public.orcamentos
     WHERE status = 'pago'
       AND checkout_em IS NOT NULL
       AND checkout_em < now() - interval '3 days'
  LOOP
    UPDATE public.orcamentos
       SET status = 'concluido', updated_at = now()
     WHERE id = v_row.id;

    INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
    VALUES (
      v_row.cliente_id,
      'Serviço concluído automaticamente',
      'Você não confirmou "' || v_row.service_name || '" em 3 dias após a finalização. O serviço foi marcado como concluído e o pagamento liberado ao prestador.',
      v_row.id,
      '/cliente?tab=pedidos&pedidoId=' || v_row.id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_concluir_orcamentos_vencidos() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.auto_concluir_orcamentos_vencidos() TO service_role;

-- 5) Agenda no pg_cron: roda de hora em hora
DO $$ BEGIN
  PERFORM cron.unschedule('auto-concluir-orcamentos-3d');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'auto-concluir-orcamentos-3d',
  '15 * * * *',
  $$ SELECT public.auto_concluir_orcamentos_vencidos(); $$
);
