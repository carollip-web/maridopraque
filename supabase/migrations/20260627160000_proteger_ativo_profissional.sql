-- Só admins (ou processos internos com service role / auth.uid() nulo) podem
-- alterar o campo `ativo` do profissional. O próprio profissional não muda o
-- seu status — ele solicita ao admin. Novos perfis nascem inativos.

CREATE OR REPLACE FUNCTION public.proteger_ativo_profissional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.ativo := false;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.ativo := OLD.ativo;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_ativo_profissional ON public.profissional_perfil;
CREATE TRIGGER trg_proteger_ativo_profissional
  BEFORE INSERT OR UPDATE ON public.profissional_perfil
  FOR EACH ROW EXECUTE FUNCTION public.proteger_ativo_profissional();
