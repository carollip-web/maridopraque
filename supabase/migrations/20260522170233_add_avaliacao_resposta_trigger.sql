CREATE OR REPLACE FUNCTION public.handle_avaliacao_resposta_notificacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.resposta_profissional IS NOT NULL AND OLD.resposta_profissional IS NULL THEN
    INSERT INTO public.notificacoes (user_id, orcamento_id, titulo, mensagem, link)
    VALUES (
      NEW.cliente_id,
      NEW.orcamento_id,
      'Novo comentário do Profissional',
      'O profissional respondeu à sua avaliação do serviço.',
      '/cliente'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_avaliacao_resposta_notificacao ON public.avaliacoes;
CREATE TRIGGER tr_avaliacao_resposta_notificacao
AFTER UPDATE OF resposta_profissional ON public.avaliacoes
FOR EACH ROW
EXECUTE FUNCTION public.handle_avaliacao_resposta_notificacao();
