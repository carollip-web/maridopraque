CREATE OR REPLACE FUNCTION public.confirmar_convite(p_convite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lead record;
    v_uid uuid;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    -- Fetch the lead
    SELECT * INTO v_lead FROM public.profissionais_pre_cadastro WHERE id = p_convite_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite não encontrado';
    END IF;

    IF v_lead.status != 'convidado' THEN
        RAISE EXCEPTION 'Este convite não é mais válido (status: %)', v_lead.status;
    END IF;

    -- Update the role to profissional
    UPDATE public.user_roles 
    SET role = 'profissional' 
    WHERE user_id = v_uid;

    -- Insert if it didn't exist for some reason
    IF NOT FOUND THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'profissional');
    END IF;

    -- Create initial professional profile with data from the lead
    INSERT INTO public.profissional_perfil (
        user_id, 
        ativo, 
        aprovacao_status, 
        especialidades, 
        cidade
    ) VALUES (
        v_uid, 
        false, 
        'em_analise', 
        ARRAY[v_lead.especialidade_principal]::text[], 
        v_lead.cidade
    )
    ON CONFLICT (user_id) DO UPDATE 
    SET especialidades = ARRAY[v_lead.especialidade_principal]::text[],
        cidade = v_lead.cidade;

    -- Update lead status
    UPDATE public.profissionais_pre_cadastro 
    SET status = 'convertido' 
    WHERE id = p_convite_id;

END;
$$;
