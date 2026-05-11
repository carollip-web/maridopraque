-- Melhora o gatilho de notificação para distribuir pedidos apenas para quem tem a especialidade e está aprovado
CREATE OR REPLACE FUNCTION public.notify_orcamento_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Notify client
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
      UPDATE public.profiles SET total_servicos_pagos = total_servicos_pagos + 1
        WHERE id = NEW.cliente_id;
    END IF;
  END IF;

  -- Distribuição inteligente: quando pendente, notifica profissionais aprovados que possuem a especialidade
  IF TG_OP = 'INSERT' AND NEW.status = 'customizado_pendente' THEN
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
    SELECT pp.user_id,
      'Nova solicitação: ' || NEW.service_name,
      'Um cliente pediu um orçamento. Corra para pegar a oportunidade!',
      NEW.id, '/profissional?orcamentoId=' || NEW.id
    FROM public.profissional_perfil pp
    WHERE pp.aprovacao_status = 'aprovado'
      AND pp.ativo = true
      AND NEW.service_name = ANY(pp.especialidades);
  END IF;

  RETURN NEW;
END;
$$;
