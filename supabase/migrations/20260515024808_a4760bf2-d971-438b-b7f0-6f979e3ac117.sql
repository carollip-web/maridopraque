
-- ============================================================
-- ORCAMENTOS: campos de preferências de atendimento/agenda
-- ============================================================
alter table public.orcamentos add column if not exists tipo_atendimento text;
alter table public.orcamentos add column if not exists data_preferida date;
alter table public.orcamentos add column if not exists periodo_preferido text;
alter table public.orcamentos add column if not exists horario_preferido time;
alter table public.orcamentos add column if not exists flexibilidade_agenda text;
alter table public.orcamentos add column if not exists fotos_problema text[] not null default '{}';
alter table public.orcamentos add column if not exists valor_servico numeric;
alter table public.orcamentos add column if not exists observacoes_profissional text;
alter table public.orcamentos add column if not exists data_aprovacao timestamptz;

-- ============================================================
-- PROFISSIONAL_PERFIL: campos operacionais
-- ============================================================
alter table public.profissional_perfil add column if not exists genero text;
alter table public.profissional_perfil add column if not exists oferece_apoio_feminino boolean not null default false;
alter table public.profissional_perfil add column if not exists anos_experiencia integer;
alter table public.profissional_perfil add column if not exists raio_atendimento_km integer;
alter table public.profissional_perfil add column if not exists chave_pix text;
alter table public.profissional_perfil add column if not exists atende_emergencias boolean default false;
alter table public.profissional_perfil add column if not exists veiculo_proprio boolean default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profissional_perfil_genero_check'
  ) then
    alter table public.profissional_perfil
      add constraint profissional_perfil_genero_check
      check (genero is null or genero in ('homem', 'mulher', 'outro', 'nao_informar'));
  end if;
end $$;

-- ============================================================
-- PROFISSIONAL_BLOQUEIOS_AGENDA
-- ============================================================
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

create index if not exists idx_pba_profissional on public.profissional_bloqueios_agenda (profissional_id);
create index if not exists idx_pba_orcamento on public.profissional_bloqueios_agenda (orcamento_id);
create index if not exists idx_pba_intervalo on public.profissional_bloqueios_agenda (profissional_id, inicio, fim);

alter table public.profissional_bloqueios_agenda enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profissional_bloqueios_agenda'
      and policyname='Profissional ve proprios bloqueios agenda'
  ) then
    create policy "Profissional ve proprios bloqueios agenda"
      on public.profissional_bloqueios_agenda for select
      using (auth.uid() = profissional_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profissional_bloqueios_agenda'
      and policyname='Cliente ve bloqueios do proprio orcamento'
  ) then
    create policy "Cliente ve bloqueios do proprio orcamento"
      on public.profissional_bloqueios_agenda for select
      using (
        exists (
          select 1 from public.orcamentos o
          where o.id = profissional_bloqueios_agenda.orcamento_id
            and o.cliente_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profissional_bloqueios_agenda'
      and policyname='Profissional gerencia proprios bloqueios agenda'
  ) then
    create policy "Profissional gerencia proprios bloqueios agenda"
      on public.profissional_bloqueios_agenda for all
      using (auth.uid() = profissional_id)
      with check (auth.uid() = profissional_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profissional_bloqueios_agenda'
      and policyname='Admin gerencia bloqueios agenda'
  ) then
    create policy "Admin gerencia bloqueios agenda"
      on public.profissional_bloqueios_agenda for all
      using (has_role(auth.uid(), 'admin'::app_role))
      with check (has_role(auth.uid(), 'admin'::app_role));
  end if;
end $$;

-- updated_at trigger
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_pba_updated_at'
  ) then
    create trigger set_pba_updated_at
      before update on public.profissional_bloqueios_agenda
      for each row execute function public.set_updated_at();
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
