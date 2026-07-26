create table if not exists public.lead_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  week_start date,
  source_file text,
  status text not null default 'active'
    check (status in ('active', 'completed', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lead_batches enable row level security;

drop policy if exists "Team can view lead batches" on public.lead_batches;
create policy "Team can view lead batches"
on public.lead_batches for select
to authenticated
using (true);

drop policy if exists "Owners can create lead batches" on public.lead_batches;
create policy "Owners can create lead batches"
on public.lead_batches for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Owners can update lead batches" on public.lead_batches;
create policy "Owners can update lead batches"
on public.lead_batches for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

grant select, insert, update on public.lead_batches to authenticated;

alter table public.leads
  add column if not exists batch_id uuid
    references public.lead_batches(id) on delete set null,
  add column if not exists priority text not null default 'Normal',
  add column if not exists next_action text,
  add column if not exists next_action_at timestamptz,
  add column if not exists validated_at timestamptz,
  add column if not exists validated_by uuid
    references auth.users(id) on delete set null,
  add column if not exists discard_reason text,
  add column if not exists source_type text not null default 'excel';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_priority_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_priority_check
      check (priority in ('Urgente', 'Alta', 'Normal', 'Baixa'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_source_type_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_source_type_check
      check (source_type in ('excel', 'manual', 'instagram'));
  end if;
end
$$;

insert into public.lead_batches (
  name,
  week_start,
  source_file,
  status
)
values (
  'Lote 1',
  date_trunc('week', current_date)::date,
  'Perfis do Instagram para Prospecção (1).xlsx',
  'active'
)
on conflict (name) do nothing;

update public.leads
set
  batch_id = (
    select id
    from public.lead_batches
    where name = 'Lote 1'
  ),
  priority = case
    when priority_marked then 'Alta'
    else 'Normal'
  end,
  next_action = coalesce(next_action, 'Abrir perfil e validar'),
  source_type = coalesce(source_type, 'excel')
where batch_id is null;

create index if not exists leads_batch_validation_idx
  on public.leads (batch_id, validation_status);

create index if not exists leads_validation_priority_idx
  on public.leads (validation_status, priority);

create index if not exists lead_batches_created_at_idx
  on public.lead_batches (created_at desc);
