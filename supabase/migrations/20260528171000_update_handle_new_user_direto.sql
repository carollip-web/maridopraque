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

  IF (NEW.raw_user_meta_data->>'is_profissional') = 'true' THEN
     INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'profissional');
     INSERT INTO public.profissional_perfil (user_id, ativo, aprovacao_status)
     VALUES (NEW.id, false, 'pendente');
     RETURN NEW;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
