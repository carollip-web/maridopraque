-- Add gateway and tracking fields to pagamentos
alter table public.pagamentos 
add column if not exists gateway_preference_id text,
add column if not exists gateway_status text,
add column if not exists paid_at timestamptz,
add column if not exists webhook_last_received_at timestamptz;

-- Update types metadata for status (if needed, but usually it's just text)
comment on column public.pagamentos.status is 'pending, checkout_created, paid, failed, canceled, refunded';
