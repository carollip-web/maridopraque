-- Create pagamentos table
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  cliente_id uuid not null references auth.users(id),
  profissional_id uuid references auth.users(id),
  valor_total numeric not null,
  valor_sinal numeric default 0,
  valor_restante numeric default 0,
  metodo text,
  gateway text,
  gateway_payment_id text,
  status text not null default 'pending',
  checkout_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.pagamentos enable row level security;

drop policy if exists "Clientes podem ver seus próprios pagamentos" on public.pagamentos;
create policy "Clientes podem ver seus próprios pagamentos"
  on public.pagamentos for select
  using (auth.uid() = cliente_id);

drop policy if exists "Profissionais podem ver pagamentos de seus serviços" on public.pagamentos;
create policy "Profissionais podem ver pagamentos de seus serviços"
  on public.pagamentos for select
  using (auth.uid() = profissional_id);

drop policy if exists "Admins podem ver todos os pagamentos" on public.pagamentos;
create policy "Admins podem ver todos os pagamentos"
  on public.pagamentos for select
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
      and (
        role = 'admin'::app_role
        or admin_level::text in ('super_admin', 'financeiro')
      )
    )
  );

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_pagamentos_updated_at on public.pagamentos;
create trigger tr_pagamentos_updated_at
  before update on public.pagamentos
  for each row
  execute function public.handle_updated_at();

create index if not exists idx_pagamentos_orcamento_id on public.pagamentos(orcamento_id);
create index if not exists idx_pagamentos_cliente_id on public.pagamentos(cliente_id);
create index if not exists idx_pagamentos_status on public.pagamentos(status);
