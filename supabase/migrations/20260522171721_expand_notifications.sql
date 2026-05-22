-- Atualiza a função notify_orcamento_change para incluir novos status (pago, concluido, cancelado)
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
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
      VALUES (NEW.profissional_id,
        'Serviço pago e agendado!',
        'O cliente realizou o pagamento para "' || NEW.service_name || '". Confira os detalhes na sua agenda.',
        NEW.id, '/profissional?tab=servicos&orcamentoId=' || NEW.id);
        
      UPDATE public.profiles SET total_servicos_pagos = total_servicos_pagos + 1
        WHERE id = NEW.cliente_id;
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


-- Cria função e gatilho para notificar profissionais quando o perfil for aprovado ou rejeitado
CREATE OR REPLACE FUNCTION public.notify_profissional_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.aprovacao_status IS DISTINCT FROM NEW.aprovacao_status THEN
    IF NEW.aprovacao_status = 'aprovado' THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      VALUES (
        NEW.user_id,
        'Perfil Aprovado! 🎉',
        'Seu perfil foi aprovado com sucesso! Você já pode receber pedidos e enviar propostas na sua região.',
        '/profissional?tab=orcamentos'
      );
    ELSIF NEW.aprovacao_status = 'rejeitado' THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      VALUES (
        NEW.user_id,
        'Atenção ao seu Perfil',
        'Houve uma atualização no status do seu perfil. Por favor, revise seus dados ou contate o suporte.',
        '/profissional?tab=conta'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_profissional_approval ON public.profissional_perfil;
CREATE TRIGGER tr_notify_profissional_approval
  AFTER UPDATE ON public.profissional_perfil
  FOR EACH ROW EXECUTE FUNCTION public.notify_profissional_approval();
