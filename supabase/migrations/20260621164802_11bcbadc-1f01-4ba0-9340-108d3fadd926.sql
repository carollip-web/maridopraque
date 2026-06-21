
CREATE TABLE public.mp_smoke_test_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ambiente text NOT NULL,
  amount numeric(10,2) NOT NULL,
  payment_id text,
  status_final text,
  ok boolean NOT NULL DEFAULT false,
  error text,
  message text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_mp_response jsonb
);

CREATE INDEX mp_smoke_test_logs_created_at_idx
  ON public.mp_smoke_test_logs (created_at DESC);

GRANT SELECT ON public.mp_smoke_test_logs TO authenticated;
GRANT ALL ON public.mp_smoke_test_logs TO service_role;

ALTER TABLE public.mp_smoke_test_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view smoke test logs"
  ON public.mp_smoke_test_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
