
CREATE TABLE public.btg_cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL,
  pagamento_id uuid,
  cliente_id uuid NOT NULL,
  tx_id text NOT NULL UNIQUE,
  emv text,
  qrcode_url text,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','paga','expirada','desvinculada','falhou')),
  expires_at timestamptz,
  paid_at timestamptz,
  paid_amount numeric,
  payer_tax_id text,
  payer_name text,
  btg_request jsonb,
  btg_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX btg_cobrancas_unica_ativa_por_orcamento
  ON public.btg_cobrancas (orcamento_id)
  WHERE status = 'ativa';

CREATE INDEX btg_cobrancas_orcamento_idx ON public.btg_cobrancas (orcamento_id);
CREATE INDEX btg_cobrancas_cliente_idx ON public.btg_cobrancas (cliente_id);
CREATE INDEX btg_cobrancas_status_idx ON public.btg_cobrancas (status);

ALTER TABLE public.btg_cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente ve suas cobrancas"
  ON public.btg_cobrancas FOR SELECT
  USING (auth.uid() = cliente_id);

CREATE POLICY "Admin financeiro ve todas cobrancas"
  ON public.btg_cobrancas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND (ur.admin_level::text = ANY (ARRAY['super_admin','financeiro']))
    )
  );

CREATE TRIGGER btg_cobrancas_set_updated_at
  BEFORE UPDATE ON public.btg_cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.btg_cobrancas;
ALTER TABLE public.btg_cobrancas REPLICA IDENTITY FULL;
