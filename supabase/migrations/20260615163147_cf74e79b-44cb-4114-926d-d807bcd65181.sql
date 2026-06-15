
-- 1) profissional_perfil: substitui policy ALL por policies explícitas
DROP POLICY IF EXISTS "Profissional edita proprio perfil" ON public.profissional_perfil;
CREATE POLICY "Profissional insere proprio perfil" ON public.profissional_perfil
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Profissional atualiza proprio perfil" ON public.profissional_perfil
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Profissional deleta proprio perfil" ON public.profissional_perfil
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2) services_catalog: leitura completa só para admin; view pública sem cols sensíveis
DROP POLICY IF EXISTS "Catalog public read" ON public.services_catalog;
CREATE POLICY "Admin reads full catalog" ON public.services_catalog
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.services_catalog_publico
WITH (security_invoker = true) AS
SELECT id, nome, categoria, descricao, preco_fixo, is_fixed_price, ativo, created_at,
       preco_min, preco_max, slug, complexidade,
       apoio_feminino_valor, urgencia_noturno_factor, domingo_feriado_factor
  FROM public.services_catalog
 WHERE ativo = true;
GRANT SELECT ON public.services_catalog_publico TO anon, authenticated;

-- 3) orcamentos: remove caminho de auto-atribuição como apoio_profissional_id
DROP POLICY IF EXISTS "Cliente/profissional/admin atualizam" ON public.orcamentos;
CREATE POLICY "Cliente/profissional/admin atualizam" ON public.orcamentos
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = cliente_id
    OR auth.uid() = profissional_id
    OR auth.uid() = apoio_profissional_id
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = cliente_id
    OR auth.uid() = profissional_id
    OR auth.uid() = apoio_profissional_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.assumir_vaga_apoio_feminino(_orcamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_perfil RECORD;
  v_orc RECORD;
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT public.has_role(v_uid, 'profissional') THEN
    RAISE EXCEPTION 'Apenas profissionais podem assumir vagas de apoio';
  END IF;

  SELECT genero, oferece_apoio_feminino, ativo, aprovacao_status
    INTO v_perfil
    FROM public.profissional_perfil
   WHERE user_id = v_uid;

  IF NOT FOUND
     OR v_perfil.ativo IS NOT TRUE
     OR v_perfil.aprovacao_status <> 'aprovado'
     OR v_perfil.genero <> 'mulher'
     OR v_perfil.oferece_apoio_feminino IS NOT TRUE THEN
    RAISE EXCEPTION 'Perfil incompatível para vaga de apoio feminino';
  END IF;

  SELECT id, apoio_profissional_id, tipo_atendimento
    INTO v_orc
    FROM public.orcamentos
   WHERE id = _orcamento_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  IF v_orc.tipo_atendimento <> 'homem_com_apoio_feminino' THEN
    RAISE EXCEPTION 'Pedido não requer apoio feminino';
  END IF;
  IF v_orc.apoio_profissional_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Vaga já preenchida');
  END IF;

  UPDATE public.orcamentos
     SET apoio_profissional_id = v_uid,
         status_apoio = 'confirmado',
         updated_at = now()
   WHERE id = _orcamento_id
     AND apoio_profissional_id IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Vaga já preenchida');
  END IF;

  RETURN jsonb_build_object('ok', true);
END
$fn$;

GRANT EXECUTE ON FUNCTION public.assumir_vaga_apoio_feminino(uuid) TO authenticated;

-- 4) orcamento_materiais: profissional só vê se tiver proposta ou for atribuído
DROP POLICY IF EXISTS "Ver materiais do próprio orçamento" ON public.orcamento_materiais;
CREATE POLICY "Ver materiais do próprio orçamento" ON public.orcamento_materiais
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orcamentos o
       WHERE o.id = orcamento_materiais.orcamento_id
         AND (
           auth.uid() = o.cliente_id
           OR auth.uid() = o.profissional_id
           OR public.has_role(auth.uid(), 'admin')
           OR (
             o.profissional_id IS NULL
             AND public.has_role(auth.uid(), 'profissional')
             AND EXISTS (
               SELECT 1 FROM public.propostas p
                WHERE p.orcamento_id = o.id
                  AND p.profissional_id = auth.uid()
             )
           )
         )
    )
  );

-- 5) repasses_profissionais: restringe btg_response a service_role
REVOKE SELECT ON public.repasses_profissionais FROM authenticated;
GRANT SELECT (
  id, profissional_id, cliente_id, orcamento_id, pagamento_id,
  valor_bruto, valor_comissao_marketplace, valor_liquido,
  status, erro, pix_key, pix_key_type, pix_holder_name, pix_holder_document,
  approved_at, cancelled_at, failed_at, paid_at, created_at, updated_at,
  btg_transfer_id, btg_contract_guid, operation_needs_approval, processing_at
) ON public.repasses_profissionais TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.repasses_profissionais TO authenticated;
GRANT ALL ON public.repasses_profissionais TO service_role;

-- 6) notificacoes: permite inserções de gatilhos do sistema (auth.uid() nulo) explicitamente
DROP POLICY IF EXISTS "Sistema insere notificacoes via definer" ON public.notificacoes;
CREATE POLICY "Sistema insere notificacoes via definer" ON public.notificacoes
  FOR INSERT WITH CHECK (
    auth.uid() IS NULL
    OR public.has_role(auth.uid(), 'admin')
  );
