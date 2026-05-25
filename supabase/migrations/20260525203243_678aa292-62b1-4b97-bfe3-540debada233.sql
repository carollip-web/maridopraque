-- ============ 1. Professional validation fields ============
ALTER TABLE public.profissional_perfil
  ADD COLUMN IF NOT EXISTS aprovacao_status text NOT NULL DEFAULT 'pendente'
    CHECK (aprovacao_status IN ('pendente', 'em_analise', 'aprovado', 'rejeitado')),
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS foto_documento_frente text,
  ADD COLUMN IF NOT EXISTS foto_documento_verso text,
  ADD COLUMN IF NOT EXISTS foto_selfie text,
  ADD COLUMN IF NOT EXISTS experiencia_anos integer,
  ADD COLUMN IF NOT EXISTS como_conheceu text,
  ADD COLUMN IF NOT EXISTS observacoes_cadastro text,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS cadastro_completo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cadastro_submetido_em timestamptz;

DROP POLICY IF EXISTS "Admin ve dados validacao" ON public.profissional_perfil;
CREATE POLICY "Admin ve dados validacao" ON public.profissional_perfil
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documentos-profissionais', 'documentos-profissionais', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Profissional upload proprio doc" ON storage.objects;
CREATE POLICY "Profissional upload proprio doc"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documentos-profissionais' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Profissional ve proprio doc" ON storage.objects;
CREATE POLICY "Profissional ve proprio doc"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documentos-profissionais' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Admin ve todos docs" ON storage.objects;
CREATE POLICY "Admin ve todos docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documentos-profissionais' AND has_role(auth.uid(), 'admin'::app_role));

-- ============ 2. notify_professionals_new_order ============
CREATE OR REPLACE FUNCTION public.notify_professionals_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    client_lat float;
    client_lng float;
    prof_record RECORD;
BEGIN
    IF NEW.status = 'customizado_pendente' THEN
        SELECT lat, lng INTO client_lat, client_lng
        FROM public.cliente_enderecos
        WHERE user_id = NEW.cliente_id AND is_padrao = true
        LIMIT 1;

        IF client_lat IS NOT NULL AND client_lng IS NOT NULL THEN
            FOR prof_record IN
                SELECT p.user_id
                FROM public.profissional_perfil p
                WHERE p.ativo = true
                AND p.lat IS NOT NULL
                AND p.lng IS NOT NULL
                AND (6371 * acos(cos(radians(client_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(client_lng)) + sin(radians(client_lat)) * sin(radians(p.lat)))) <= p.raio_atendimento_km
            LOOP
                INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link, lida)
                VALUES (prof_record.user_id,
                    'Novo pedido no radar!',
                    'Um novo pedido de "' || COALESCE(NEW.service_name, 'Serviço') || '" está disponível na sua área.',
                    NEW.id,
                    '/profissional?tab=orcamentos&orcamentoId=' || NEW.id,
                    false);
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_professionals_new_order ON public.orcamentos;
CREATE TRIGGER tr_notify_professionals_new_order
  AFTER INSERT ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.notify_professionals_new_order();

-- ============ 3. RPC confirmar_convite ============
CREATE OR REPLACE FUNCTION public.confirmar_convite(p_convite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_lead record;
    v_uid uuid;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    SELECT * INTO v_lead FROM public.profissionais_pre_cadastro WHERE id = p_convite_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite não encontrado';
    END IF;

    IF v_lead.status != 'convidado' THEN
        RAISE EXCEPTION 'Este convite não é mais válido (status: %)', v_lead.status;
    END IF;

    UPDATE public.user_roles SET role = 'profissional' WHERE user_id = v_uid;
    IF NOT FOUND THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'profissional');
    END IF;

    INSERT INTO public.profissional_perfil (user_id, ativo, aprovacao_status, especialidades, cidade)
    VALUES (v_uid, false, 'em_analise', ARRAY[v_lead.especialidade_principal]::text[], v_lead.cidade)
    ON CONFLICT (user_id) DO UPDATE
    SET especialidades = ARRAY[v_lead.especialidade_principal]::text[],
        cidade = v_lead.cidade;

    UPDATE public.profissionais_pre_cadastro SET status = 'convertido' WHERE id = p_convite_id;
END;
$$;

-- ============ 4. RPC verificar_convite ============
CREATE OR REPLACE FUNCTION public.verificar_convite(p_convite_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_lead record;
BEGIN
    SELECT * INTO v_lead FROM public.profissionais_pre_cadastro WHERE id = p_convite_id;
    IF NOT FOUND THEN
        RETURN json_build_object('valido', false, 'erro', 'Convite não encontrado');
    END IF;
    IF v_lead.status != 'convidado' THEN
        RETURN json_build_object('valido', false, 'erro', 'Este convite não é mais válido');
    END IF;
    RETURN json_build_object('valido', true,
        'nome', v_lead.nome, 'telefone', v_lead.telefone,
        'cidade', v_lead.cidade, 'especialidade', v_lead.especialidade_principal);
END;
$$;

-- ============ 5. handle_new_user com suporte a convite ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_convite_id uuid;
  v_lead record;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email);

  BEGIN
    v_convite_id := (NEW.raw_user_meta_data->>'convite_id')::uuid;
    IF v_convite_id IS NOT NULL THEN
      SELECT * INTO v_lead FROM public.profissionais_pre_cadastro WHERE id = v_convite_id;
      IF FOUND AND v_lead.status = 'convidado' THEN
         INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'profissional');
         INSERT INTO public.profissional_perfil (user_id, ativo, aprovacao_status, especialidades, cidade)
         VALUES (NEW.id, false, 'em_analise', ARRAY[v_lead.especialidade_principal]::text[], v_lead.cidade);
         UPDATE public.profissionais_pre_cadastro SET status = 'convertido' WHERE id = v_convite_id;
         RETURN NEW;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- ignora cast inválido
  END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============ 6. handle_avaliacao_resposta_notificacao ============
CREATE OR REPLACE FUNCTION public.handle_avaliacao_resposta_notificacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.resposta_profissional IS NOT NULL AND OLD.resposta_profissional IS NULL THEN
    INSERT INTO public.notificacoes (user_id, orcamento_id, titulo, mensagem, link)
    VALUES (NEW.cliente_id, NEW.orcamento_id,
      'Novo comentário do Profissional',
      'O profissional respondeu à sua avaliação do serviço.',
      '/cliente');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_avaliacao_resposta_notificacao ON public.avaliacoes;
CREATE TRIGGER tr_avaliacao_resposta_notificacao
  AFTER UPDATE OF resposta_profissional ON public.avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_avaliacao_resposta_notificacao();

-- ============ 7. notify_orcamento_change expandida ============
CREATE OR REPLACE FUNCTION public.notify_orcamento_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- ============ 8. notify_profissional_approval ============
CREATE OR REPLACE FUNCTION public.notify_profissional_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.aprovacao_status IS DISTINCT FROM NEW.aprovacao_status THEN
    IF NEW.aprovacao_status = 'aprovado' THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      VALUES (NEW.user_id,
        'Perfil Aprovado! 🎉',
        'Seu perfil foi aprovado com sucesso! Você já pode receber pedidos e enviar propostas na sua região.',
        '/profissional?tab=orcamentos');
    ELSIF NEW.aprovacao_status = 'rejeitado' THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      VALUES (NEW.user_id,
        'Atenção ao seu Perfil',
        'Houve uma atualização no status do seu perfil. Por favor, revise seus dados ou contate o suporte.',
        '/profissional?tab=conta');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_profissional_approval ON public.profissional_perfil;
CREATE TRIGGER tr_notify_profissional_approval
  AFTER UPDATE ON public.profissional_perfil
  FOR EACH ROW EXECUTE FUNCTION public.notify_profissional_approval();