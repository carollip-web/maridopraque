REVOKE EXECUTE ON FUNCTION public.process_new_orcamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_orcamento_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;