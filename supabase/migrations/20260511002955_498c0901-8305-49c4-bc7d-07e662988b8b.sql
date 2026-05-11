
-- Fotos no orçamento
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS fotos_problema text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fotos_concluido text[] NOT NULL DEFAULT '{}';

-- Geo no endereço do cliente
ALTER TABLE public.cliente_enderecos
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- Geo + raio no perfil do profissional
ALTER TABLE public.profissional_perfil
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS raio_atendimento_km integer NOT NULL DEFAULT 15;

-- Bucket público para fotos de orçamento
INSERT INTO storage.buckets (id, name, public)
VALUES ('orcamento-fotos', 'orcamento-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: leitura pública, escrita autenticada na pasta do user
DROP POLICY IF EXISTS "Orcamento fotos public read" ON storage.objects;
CREATE POLICY "Orcamento fotos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'orcamento-fotos');

DROP POLICY IF EXISTS "Orcamento fotos auth upload" ON storage.objects;
CREATE POLICY "Orcamento fotos auth upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'orcamento-fotos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Orcamento fotos auth update" ON storage.objects;
CREATE POLICY "Orcamento fotos auth update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'orcamento-fotos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Orcamento fotos auth delete" ON storage.objects;
CREATE POLICY "Orcamento fotos auth delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'orcamento-fotos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Notificação automática quando orçamento vira concluido
CREATE OR REPLACE FUNCTION public.notify_orcamento_concluido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status::text = 'concluido' THEN
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
    VALUES (
      NEW.cliente_id,
      'Avalie seu profissional',
      'O serviço "' || NEW.service_name || '" foi concluído. Conte como foi a experiência.',
      NEW.id,
      '/cliente?tab=pedidos&pedidoId=' || NEW.id || '&avaliar=1'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_orcamento_concluido ON public.orcamentos;
CREATE TRIGGER trg_notify_orcamento_concluido
AFTER UPDATE ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.notify_orcamento_concluido();
