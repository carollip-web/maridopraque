CREATE TABLE IF NOT EXISTS public.propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  profissional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor_servico numeric NOT NULL,
  observacoes text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'recusada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orcamento_id, profissional_id)
);

ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='propostas' AND policyname='Profissional ve e cria proprias propostas') THEN
    CREATE POLICY "Profissional ve e cria proprias propostas" ON public.propostas
      FOR ALL USING (auth.uid() = profissional_id) WITH CHECK (auth.uid() = profissional_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='propostas' AND policyname='Cliente ve propostas do seu orcamento') THEN
    CREATE POLICY "Cliente ve propostas do seu orcamento" ON public.propostas
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_id AND o.cliente_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='propostas' AND policyname='Admin ve tudo propostas') THEN
    CREATE POLICY "Admin ve tudo propostas" ON public.propostas
      FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_propostas_updated ON public.propostas;
CREATE TRIGGER trg_propostas_updated BEFORE UPDATE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.notify_proposta_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_cliente_id uuid;
  v_service_name text;
  v_prof_nome text;
BEGIN
  SELECT cliente_id, service_name INTO v_cliente_id, v_service_name FROM public.orcamentos WHERE id = NEW.orcamento_id;
  SELECT COALESCE(nome, email) INTO v_prof_nome FROM public.profiles WHERE id = NEW.profissional_id;

  INSERT INTO public.notificacoes (user_id, titulo, mensagem, orcamento_id, link)
  VALUES (
    v_cliente_id,
    'Nova proposta recebida',
    v_prof_nome || ' enviou uma proposta de R$ ' || NEW.valor_servico || ' para "' || v_service_name || '".',
    NEW.orcamento_id,
    '/cliente?tab=pedidos&pedidoId=' || NEW.orcamento_id
  );

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_proposta_created ON public.propostas;
CREATE TRIGGER trg_proposta_created
  AFTER INSERT ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.notify_proposta_created();

CREATE TABLE IF NOT EXISTS public.proposta_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materiais(id) ON DELETE CASCADE,
  nome_snapshot text NOT NULL,
  unidade_snapshot text NOT NULL DEFAULT 'un',
  quantidade numeric NOT NULL DEFAULT 1,
  preco_unitario numeric NOT NULL DEFAULT 0,
  subtotal numeric GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proposta_materiais ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='proposta_materiais' AND policyname='Profissional gerencia seus propostas materiais') THEN
    CREATE POLICY "Profissional gerencia seus propostas materiais" ON public.proposta_materiais
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.propostas p WHERE p.id = proposta_id AND p.profissional_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='proposta_materiais' AND policyname='Cliente ve materiais das propostas') THEN
    CREATE POLICY "Cliente ve materiais das propostas" ON public.proposta_materiais
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.propostas p
          JOIN public.orcamentos o ON p.orcamento_id = o.id
          WHERE p.id = proposta_materiais.proposta_id AND o.cliente_id = auth.uid()
        )
      );
  END IF;
END $$;