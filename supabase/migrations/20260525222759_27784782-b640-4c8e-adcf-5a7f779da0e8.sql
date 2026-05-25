
REVOKE EXECUTE ON FUNCTION public.criar_split_pagamento(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_saldos_profissional(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.liberar_splits_vencidos() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pagamento_splits_atualiza_saldo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pagamento_paid_cria_split() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_orcamento_concluido_libera_split() FROM PUBLIC, anon, authenticated;

-- processar_saque_pago tem checagem interna de admin; mantém para authenticated apenas
REVOKE EXECUTE ON FUNCTION public.processar_saque_pago(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_saque_pago(uuid) TO authenticated;
