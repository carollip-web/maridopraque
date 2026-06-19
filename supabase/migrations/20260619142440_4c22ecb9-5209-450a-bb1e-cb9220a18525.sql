
DROP POLICY IF EXISTS "Profissional le avaliacoes recebidas" ON public.avaliacoes;

ALTER VIEW public.avaliacoes_publicas SET (security_invoker = off);

REVOKE SELECT ON public.profissional_perfil FROM authenticated, anon;

GRANT SELECT (
  user_id, slug, bio, especialidades, foto_url, cidade, ativo, created_at, updated_at,
  lat, lng, raio_atendimento_km, termo_aceito_em, termo_versao, onboarding_completo,
  duracao_padrao_min, genero, oferece_apoio_feminino, anos_experiencia, chave_pix,
  atende_emergencias, veiculo_proprio, mp_user_id, mp_connected_at, mp_token_expires_at,
  pix_key_type, pix_key, pix_holder_name, pix_holder_document, pix_dados_confirmados,
  repasse_automatico, aprovacao_status, cpf, data_nascimento, telefone, cep, endereco,
  numero, complemento, bairro, estado, foto_documento_frente, foto_documento_verso,
  foto_selfie, experiencia_anos, como_conheceu, observacoes_cadastro, aprovado_por,
  aprovado_em, motivo_rejeicao, cadastro_completo, cadastro_submetido_em, cnpj,
  mp_public_key, mp_expires_at, mp_scope, mp_oauth_state_expires_at
) ON public.profissional_perfil TO authenticated;

-- Ajusta gatilho para respeitar NOT NULL nas arrays de fotos
CREATE OR REPLACE FUNCTION public.enforce_endereco_snapshot_only_when_assigned()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.profissional_id IS NULL THEN
    NEW.endereco_snapshot := NULL;
    NEW.fotos_problema := ARRAY[]::text[];
    NEW.fotos_concluido := ARRAY[]::text[];
    NEW.checkin_lat := NULL;
    NEW.checkin_lng := NULL;
    NEW.checkout_lat := NULL;
    NEW.checkout_lng := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill seguro para linhas existentes
UPDATE public.orcamentos
SET endereco_snapshot = NULL,
    fotos_problema = ARRAY[]::text[],
    fotos_concluido = ARRAY[]::text[],
    checkin_lat = NULL,
    checkin_lng = NULL,
    checkout_lat = NULL,
    checkout_lng = NULL
WHERE profissional_id IS NULL
  AND (endereco_snapshot IS NOT NULL
       OR array_length(fotos_problema, 1) > 0
       OR array_length(fotos_concluido, 1) > 0
       OR checkin_lat IS NOT NULL
       OR checkout_lat IS NOT NULL);

DROP POLICY IF EXISTS "Avatars publicos leitura" ON storage.objects;
