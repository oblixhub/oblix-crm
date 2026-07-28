begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() = 'owner', false);
$$;

create or replace function private.can_access_lead(lead_assignee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_owner()
    or lead_assignee is null
    or lead_assignee = (select auth.uid());
$$;

revoke all on function private.current_user_role() from public;
revoke all on function private.is_owner() from public;
revoke all on function private.can_access_lead(uuid) from public;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.is_owner() to authenticated;
grant execute on function private.can_access_lead(uuid) to authenticated;

alter table public.leads
  add column if not exists assigned_to uuid references public.profiles(user_id) on delete set null,
  add column if not exists archived boolean not null default false,
  add column if not exists contact_permission text not null default 'public_contact',
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists last_response_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_contact_permission_check'
  ) then
    alter table public.leads
      add constraint leads_contact_permission_check
      check (contact_permission in ('public_contact', 'opted_in', 'opted_out'));
  end if;
end
$$;

update public.leads
set assigned_to = (
  select p.user_id
  from public.profiles p
  where lower(p.display_name) = 'hugo'
  limit 1
)
where assigned_to is null and owner in ('Você', 'VocÃª');

update public.leads
set assigned_to = (
  select p.user_id
  from public.profiles p
  where lower(p.display_name) = 'raiza'
  limit 1
)
where assigned_to is null and owner in ('Sócia', 'SÃ³cia');

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references public.profiles(user_id) on delete set null,
  activity_type text not null default 'note',
  title text not null,
  detail text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.lead_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_to uuid references public.profiles(user_id) on delete set null,
  created_by uuid references public.profiles(user_id) on delete set null,
  task_type text not null default 'follow_up',
  title text not null,
  due_at timestamptz,
  status text not null default 'pending',
  priority text not null default 'Normal',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_tasks_status_check
    check (status in ('pending', 'completed', 'cancelled')),
  constraint lead_tasks_priority_check
    check (priority in ('Urgente', 'Alta', 'Normal', 'Baixa'))
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#8FFF00',
  category text not null default 'Personalizada',
  is_system boolean not null default false,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists tags_name_normalized_unique_idx
  on public.tags (lower(trim(name)));

create table if not exists public.lead_tags (
  lead_id uuid not null references public.leads(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  added_by uuid references public.profiles(user_id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (lead_id, tag_id)
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Prospecção',
  message text not null,
  favorite boolean not null default false,
  shared boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_commercial (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  offer_type text not null default 'Sem domínio',
  amount numeric(12,2) not null default 0 check (amount >= 0),
  payment_method text not null default 'Não definido',
  installments_count integer not null default 1
    check (installments_count between 1 and 24),
  status text not null default 'Não negociado',
  next_charge_at timestamptz,
  domain_included boolean not null default false,
  delivery_status text not null default 'Não iniciado',
  private_notes text not null default '',
  updated_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_commercial_status_check
    check (status in (
      'Não negociado',
      'Negociação',
      'Aguardando pagamento',
      'Parcial',
      'Pago',
      'Atrasado',
      'Cancelado'
    ))
);

create table if not exists public.payment_installments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.lead_commercial(lead_id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  amount numeric(12,2) not null check (amount >= 0),
  due_date date not null,
  status text not null default 'Pendente',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, installment_number),
  constraint payment_installments_status_check
    check (status in ('Pendente', 'Pago', 'Atrasado', 'Cancelado'))
);

create table if not exists public.lead_projects (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  status text not null default 'Aguardando materiais',
  materials_notes text not null default '',
  revision_notes text not null default '',
  delivery_notes text not null default '',
  domain_name text,
  delivery_due_at timestamptz,
  delivered_at timestamptz,
  updated_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_projects_status_check
    check (status in (
      'Aguardando materiais',
      'Materiais recebidos',
      'Em produção',
      'Revisão interna',
      'Preview enviado',
      'Ajustes solicitados',
      'Aprovado',
      'Pagamento pendente',
      'Pago',
      'Entregue'
    ))
);

create table if not exists public.crm_settings (
  singleton boolean primary key default true check (singleton),
  daily_contact_goal integer not null default 20 check (daily_contact_goal between 1 and 200),
  first_follow_up_days integer not null default 2 check (first_follow_up_days between 1 and 30),
  second_follow_up_days integer not null default 3 check (second_follow_up_days between 1 and 30),
  updated_by uuid references public.profiles(user_id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.crm_settings (singleton)
values (true)
on conflict (singleton) do nothing;

insert into public.tags (name, color, category, is_system)
values
  ('Resposta lenta', '#F59E0B', 'Comportamento', true),
  ('Responde rápido', '#22C55E', 'Comportamento', true),
  ('Pediu para retornar', '#60A5FA', 'Comportamento', true),
  ('Quente', '#EF4444', 'Interesse', true),
  ('Morno', '#F59E0B', 'Interesse', true),
  ('Frio', '#94A3B8', 'Interesse', true),
  ('Objeção: preço', '#A78BFA', 'Objeção', true),
  ('Sem tempo', '#64748B', 'Objeção', true),
  ('Desconfiança', '#FB7185', 'Objeção', true),
  ('Já tem site', '#64748B', 'Objeção', true),
  ('Faltam fotos', '#38BDF8', 'Materiais', true),
  ('Faltam textos', '#22D3EE', 'Materiais', true),
  ('Materiais completos', '#10B981', 'Materiais', true),
  ('Não contatar', '#EF4444', 'Segurança', true)
on conflict do nothing;

insert into public.lead_activities (
  lead_id,
  activity_type,
  title,
  detail,
  occurred_at
)
select
  l.id,
  'validation',
  'Lead importado',
  coalesce(l.professional_evidence, 'Lead adicionado ao CRM.'),
  l.created_at
from public.leads l
where not exists (
  select 1
  from public.lead_activities a
  where a.lead_id = l.id
);

insert into public.lead_tasks (
  lead_id,
  assigned_to,
  task_type,
  title,
  due_at,
  status,
  priority
)
select
  l.id,
  l.assigned_to,
  case
    when l.prospecting_done then 'follow_up'
    else 'initial_contact'
  end,
  l.next_action,
  l.next_action_at,
  'pending',
  l.priority
from public.leads l
where
  l.validation_status = 'valid'
  and not l.archived
  and not l.do_not_contact
  and l.next_action <> 'Nenhuma ação necessária'
  and not exists (
    select 1
    from public.lead_tasks t
    where t.lead_id = l.id and t.status = 'pending'
  );

create index if not exists leads_operational_queue_idx
  on public.leads (assigned_to, next_action_at, priority)
  where validation_status = 'valid' and not archived and not do_not_contact;

create index if not exists lead_activities_lead_time_idx
  on public.lead_activities (lead_id, occurred_at desc);

create index if not exists lead_tasks_queue_idx
  on public.lead_tasks (assigned_to, status, due_at)
  where status = 'pending';

create index if not exists lead_tags_tag_idx
  on public.lead_tags (tag_id, lead_id);

create index if not exists payment_installments_due_idx
  on public.payment_installments (status, due_date)
  where status in ('Pendente', 'Atrasado');

alter table public.lead_activities enable row level security;
alter table public.lead_tasks enable row level security;
alter table public.tags enable row level security;
alter table public.lead_tags enable row level security;
alter table public.message_templates enable row level security;
alter table public.lead_commercial enable row level security;
alter table public.payment_installments enable row level security;
alter table public.lead_projects enable row level security;
alter table public.crm_settings enable row level security;

drop policy if exists leads_authenticated_select on public.leads;
drop policy if exists leads_authenticated_insert on public.leads;
drop policy if exists leads_authenticated_update on public.leads;
drop policy if exists leads_authenticated_delete on public.leads;

create policy leads_operational_select
  on public.leads for select
  to authenticated
  using (private.can_access_lead(assigned_to));

create policy leads_operational_insert
  on public.leads for insert
  to authenticated
  with check (
    private.is_owner()
    or assigned_to is null
    or assigned_to = (select auth.uid())
  );

create policy leads_operational_update
  on public.leads for update
  to authenticated
  using (private.can_access_lead(assigned_to))
  with check (
    private.is_owner()
    or assigned_to is null
    or assigned_to = (select auth.uid())
  );

create policy leads_owner_delete
  on public.leads for delete
  to authenticated
  using (private.is_owner());

create policy lead_activities_accessible_select
  on public.lead_activities for select
  to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_id
      and private.can_access_lead(l.assigned_to)
    )
  );

create policy lead_activities_accessible_insert
  on public.lead_activities for insert
  to authenticated
  with check (
    actor_id = (select auth.uid())
    and exists (
      select 1 from public.leads l
      where l.id = lead_id
      and private.can_access_lead(l.assigned_to)
    )
  );

create policy lead_activities_owner_delete
  on public.lead_activities for delete
  to authenticated
  using (private.is_owner());

create policy lead_tasks_accessible_select
  on public.lead_tasks for select
  to authenticated
  using (
    private.is_owner()
    or assigned_to is null
    or assigned_to = (select auth.uid())
  );

create policy lead_tasks_accessible_insert
  on public.lead_tasks for insert
  to authenticated
  with check (
    private.is_owner()
    or assigned_to is null
    or assigned_to = (select auth.uid())
  );

create policy lead_tasks_accessible_update
  on public.lead_tasks for update
  to authenticated
  using (
    private.is_owner()
    or assigned_to is null
    or assigned_to = (select auth.uid())
  )
  with check (
    private.is_owner()
    or assigned_to is null
    or assigned_to = (select auth.uid())
  );

create policy lead_tasks_owner_delete
  on public.lead_tasks for delete
  to authenticated
  using (private.is_owner());

create policy tags_team_select
  on public.tags for select
  to authenticated
  using (true);

create policy tags_owner_insert
  on public.tags for insert
  to authenticated
  with check (private.is_owner());

create policy tags_owner_update
  on public.tags for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

create policy tags_owner_delete
  on public.tags for delete
  to authenticated
  using (private.is_owner() and not is_system);

create policy lead_tags_accessible_select
  on public.lead_tags for select
  to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_id
      and private.can_access_lead(l.assigned_to)
    )
  );

create policy lead_tags_accessible_insert
  on public.lead_tags for insert
  to authenticated
  with check (
    added_by = (select auth.uid())
    and exists (
      select 1 from public.leads l
      where l.id = lead_id
      and private.can_access_lead(l.assigned_to)
    )
  );

create policy lead_tags_accessible_delete
  on public.lead_tags for delete
  to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_id
      and private.can_access_lead(l.assigned_to)
    )
  );

create policy message_templates_team_select
  on public.message_templates for select
  to authenticated
  using (shared or created_by = (select auth.uid()) or private.is_owner());

create policy message_templates_owner_insert
  on public.message_templates for insert
  to authenticated
  with check (private.is_owner());

create policy message_templates_owner_update
  on public.message_templates for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

create policy message_templates_owner_delete
  on public.message_templates for delete
  to authenticated
  using (private.is_owner());

create policy lead_commercial_owner_all
  on public.lead_commercial for all
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

create policy payment_installments_owner_all
  on public.payment_installments for all
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

create policy lead_projects_owner_all
  on public.lead_projects for all
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

create policy crm_settings_team_select
  on public.crm_settings for select
  to authenticated
  using (true);

create policy crm_settings_owner_update
  on public.crm_settings for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "crm team can upload preview zips" on storage.objects;
create policy "owners can upload preview zips"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'preview-zips'
    and private.is_owner()
  );

grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, delete on public.lead_activities to authenticated;
grant select, insert, update, delete on public.lead_tasks to authenticated;
grant select, insert, update, delete on public.tags to authenticated;
grant select, insert, delete on public.lead_tags to authenticated;
grant select, insert, update, delete on public.message_templates to authenticated;
grant select, insert, update, delete on public.lead_commercial to authenticated;
grant select, insert, update, delete on public.payment_installments to authenticated;
grant select, insert, update, delete on public.lead_projects to authenticated;
grant select, update on public.crm_settings to authenticated;

commit;
