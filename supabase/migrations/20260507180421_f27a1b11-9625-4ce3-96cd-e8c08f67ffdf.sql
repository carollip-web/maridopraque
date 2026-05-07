
-- Tighten notificacoes insert policy (triggers run as SECURITY DEFINER, bypass RLS)
DROP POLICY IF EXISTS "Sistema/admin insere notificações" ON public.notificacoes;
CREATE POLICY "Admin insere notificações" ON public.notificacoes
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Revoke execute on internal trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_new_orcamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_orcamento_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
