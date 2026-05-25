CREATE TABLE IF NOT EXISTS public.btg_boletos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL,
  pagamento_id uuid,
  cliente_id uuid NOT NULL,
  btg_payment_link_id text NOT NULL,
  external_id text NOT NULL,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  payment_url text,
  status text NOT NULL DEFAULT 'pendente',
  paid_at timestamptz,
  paid_amount numeric,
  payer_tax_id text,
  payer_name text,
  btg_request jsonb,
  btg_response jsonb,
  last_status_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_btg_boletos_orcamento ON public.btg_boletos(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_btg_boletos_status ON public.btg_boletos(status);

ALTER TABLE public.btg_boletos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente ve seus boletos"
ON public.btg_boletos FOR SELECT
USING (auth.uid() = cliente_id);

CREATE POLICY "Admin financeiro ve todos boletos"
ON public.btg_boletos FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
    AND ur.admin_level::text IN ('super_admin', 'financeiro')
));

CREATE TRIGGER btg_boletos_set_updated_at
BEFORE UPDATE ON public.btg_boletos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();