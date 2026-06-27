
INSERT INTO public.email_templates (slug, nome, descricao, assunto, html, variaveis, ativo)
VALUES (
  'profissional_aprovado',
  'Profissional aprovado',
  'Enviado quando o admin aprova o cadastro de um profissional. O assunto vira o título da notificação/e-mail; o conteúdo vira a mensagem.',
  '🎉 Cadastro aprovado!',
  'Parabéns! Seu cadastro foi aprovado e seu perfil já está ativo. Agora você pode receber pedidos de clientes na sua região, enviar propostas e conectar sua conta Mercado Pago para receber os pagamentos diretamente. Acesse o painel para começar.',
  '["nome"]'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_profissional_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_titulo text;
  v_mensagem text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.aprovacao_status IS DISTINCT FROM NEW.aprovacao_status THEN
    IF NEW.aprovacao_status = 'aprovado' THEN
      SELECT assunto, html INTO v_titulo, v_mensagem
        FROM public.email_templates
       WHERE slug = 'profissional_aprovado' AND ativo = true
       LIMIT 1;

      INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      VALUES (
        NEW.user_id,
        COALESCE(v_titulo, '🎉 Cadastro aprovado!'),
        COALESCE(v_mensagem, 'Parabéns! Seu cadastro foi aprovado. Agora você pode receber pedidos e conectar sua conta Mercado Pago para receber pagamentos.'),
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
