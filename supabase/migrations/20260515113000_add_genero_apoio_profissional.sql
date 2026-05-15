alter table public.profissional_perfil
add column if not exists genero text;

alter table public.profissional_perfil
add column if not exists oferece_apoio_feminino boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profissional_perfil_genero_check'
  ) then
    alter table public.profissional_perfil
    add constraint profissional_perfil_genero_check
    check (
      genero is null
      or genero in ('homem', 'mulher', 'outro', 'nao_informar')
    );
  end if;
end $$;

comment on column public.profissional_perfil.genero is
'Gênero operacional informado pelo profissional para compatibilidade com tipo de atendimento.';

comment on column public.profissional_perfil.oferece_apoio_feminino is
'Indica se o profissional possui apoio feminino disponível para atendimentos acompanhados.';

select pg_notify('pgrst', 'reload schema');
