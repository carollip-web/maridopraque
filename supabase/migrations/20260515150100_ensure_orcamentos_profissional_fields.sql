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

select pg_notify('pgrst', 'reload schema');
