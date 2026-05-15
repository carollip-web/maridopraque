alter table public.orcamentos
add column if not exists tipo_atendimento text;

alter table public.orcamentos
add column if not exists data_preferida date;

alter table public.orcamentos
add column if not exists periodo_preferido text;

alter table public.orcamentos
add column if not exists horario_preferido time;

alter table public.orcamentos
add column if not exists flexibilidade_agenda text;

alter table public.orcamentos
add column if not exists fotos_problema text[] default '{}';

alter table public.orcamentos
add column if not exists valor_servico numeric;

alter table public.orcamentos
add column if not exists observacoes_profissional text;

alter table public.orcamentos
add column if not exists data_aprovacao timestamptz;

alter table public.profissional_perfil
add column if not exists genero text;

alter table public.profissional_perfil
add column if not exists oferece_apoio_feminino boolean not null default false;

alter table public.profissional_perfil
add column if not exists anos_experiencia integer;

alter table public.profissional_perfil
add column if not exists raio_atendimento_km integer;

alter table public.profissional_perfil
add column if not exists chave_pix text;

alter table public.profissional_perfil
add column if not exists atende_emergencias boolean default false;

alter table public.profissional_perfil
add column if not exists veiculo_proprio boolean default false;

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
  updated_at timestamptz not null default now()
);

create index if not exists idx_profissional_bloqueios_agenda_profissional
on public.profissional_bloqueios_agenda (profissional_id);

create index if not exists idx_profissional_bloqueios_agenda_orcamento
on public.profissional_bloqueios_agenda (orcamento_id);

create index if not exists idx_profissional_bloqueios_agenda_intervalo
on public.profissional_bloqueios_agenda (profissional_id, inicio, fim);

alter table public.profissional_bloqueios_agenda enable row level security;

drop policy if exists "Profissionais veem seus bloqueios de agenda"
on public.profissional_bloqueios_agenda;

create policy "Profissionais veem seus bloqueios de agenda"
on public.profissional_bloqueios_agenda
for select
using (auth.uid() = profissional_id);

drop policy if exists "Clientes veem bloqueios dos seus pedidos"
on public.profissional_bloqueios_agenda;

create policy "Clientes veem bloqueios dos seus pedidos"
on public.profissional_bloqueios_agenda
for select
using (
  exists (
    select 1
    from public.orcamentos o
    where o.id = profissional_bloqueios_agenda.orcamento_id
      and o.cliente_id = auth.uid()
  )
);

drop policy if exists "Admin gerencia bloqueios agenda"
on public.profissional_bloqueios_agenda;

create policy "Admin gerencia bloqueios agenda"
on public.profissional_bloqueios_agenda
for all
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Profissional gerencia proprios bloqueios agenda"
on public.profissional_bloqueios_agenda;

create policy "Profissional gerencia proprios bloqueios agenda"
on public.profissional_bloqueios_agenda
for all
using (auth.uid() = profissional_id)
with check (auth.uid() = profissional_id);

grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated, service_role;
grant execute on function public.is_super_admin(uuid) to anon, authenticated, service_role;

select pg_notify('pgrst', 'reload schema');
notify pgrst, 'reload schema';