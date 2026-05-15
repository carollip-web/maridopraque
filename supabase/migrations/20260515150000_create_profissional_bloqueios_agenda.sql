create table if not exists public.profissional_bloqueios_agenda (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null,
  orcamento_id uuid null references public.orcamentos(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'temporario',
  motivo text null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profissional_bloqueios_agenda_status_check
    check (status in ('temporario', 'confirmado', 'cancelado', 'expirado'))
);

create index if not exists idx_profissional_bloqueios_agenda_profissional
on public.profissional_bloqueios_agenda (profissional_id);

create index if not exists idx_profissional_bloqueios_agenda_orcamento
on public.profissional_bloqueios_agenda (orcamento_id);

create index if not exists idx_profissional_bloqueios_agenda_intervalo
on public.profissional_bloqueios_agenda (profissional_id, inicio, fim);

alter table public.profissional_bloqueios_agenda enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profissional_bloqueios_agenda'
      and policyname = 'Profissionais veem seus bloqueios de agenda'
  ) then
    create policy "Profissionais veem seus bloqueios de agenda"
    on public.profissional_bloqueios_agenda
    for select
    using (auth.uid() = profissional_id);
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
