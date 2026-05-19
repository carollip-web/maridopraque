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

DROP POLICY IF EXISTS "Profissional gerencia seus propostas materiais" ON public.proposta_materiais;
CREATE POLICY "Profissional gerencia seus propostas materiais" ON public.proposta_materiais
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.propostas p WHERE p.id = proposta_id AND p.profissional_id = auth.uid())
  );

DROP POLICY IF EXISTS "Cliente ve materiais das propostas" ON public.proposta_materiais;
CREATE POLICY "Cliente ve materiais das propostas" ON public.proposta_materiais
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.propostas p
      JOIN public.orcamentos o ON p.orcamento_id = o.id
      WHERE p.id = proposta_materiais.proposta_id AND o.cliente_id = auth.uid()
    )
  );
