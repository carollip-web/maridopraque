CREATE OR REPLACE FUNCTION public.verificar_convite(p_convite_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    RETURN json_build_object(
        'valido', true, 
        'nome', v_lead.nome,
        'telefone', v_lead.telefone,
        'cidade', v_lead.cidade,
        'especialidade', v_lead.especialidade_principal
    );
END;
$$;
