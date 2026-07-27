-- Support manual lead capture through the internal Chrome extension.
-- The extension never talks to Supabase directly; only the server-side API
-- uses an administrative key.

alter table public.leads
  add column if not exists instagram_username_normalized text
    generated always as (
      lower(regexp_replace(btrim(handle), '^@+', ''))
    ) stored,
  add column if not exists whatsapp_raw text,
  add column if not exists whatsapp_number text,
  add column if not exists qualification_status text not null default 'pending',
  add column if not exists captured_by text,
  add column if not exists captured_at timestamptz,
  add column if not exists extension_version text;

do $$
begin
  alter table public.leads
    drop constraint if exists leads_source_type_check;

  alter table public.leads
    add constraint leads_source_type_check
    check (source_type in ('excel', 'manual', 'instagram', 'chrome_extension'));

  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_qualification_status_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_qualification_status_check
      check (qualification_status in ('pending', 'qualified', 'discarded'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_whatsapp_number_format_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_whatsapp_number_format_check
      check (
        whatsapp_number is null
        or whatsapp_number ~ '^[1-9][0-9]{7,14}$'
      );
  end if;
end
$$;

-- This index deliberately fails if legacy rows only differ by @ or case.
-- Nothing is removed automatically; resolve those rows explicitly, then
-- re-run the migration.
create unique index if not exists leads_instagram_username_normalized_unique_idx
  on public.leads (instagram_username_normalized)
  where instagram_username_normalized <> '';

insert into public.lead_batches (
  name,
  week_start,
  source_file,
  status
)
values (
  'Extensão Chrome',
  date_trunc('week', current_date)::date,
  'OBLIX Lead Saver',
  'active'
)
on conflict (name) do nothing;

create index if not exists leads_extension_capture_rate_idx
  on public.leads (captured_by, captured_at desc)
  where source_type = 'chrome_extension';

create index if not exists leads_source_type_created_at_idx
  on public.leads (source_type, created_at desc);

comment on column public.leads.instagram_username_normalized is
  'Instagram username without @, trimmed and lowercased; used for deduplication.';
comment on column public.leads.captured_by is
  'Operator identity resolved from the server-side extension token.';
comment on column public.leads.captured_at is
  'Timestamp recorded by the server when the extension capture is accepted.';

-- RLS remains enabled and no browser-facing insert policy is added.
-- The API uses the private service_role/secret key only on the server.
grant select, insert, update on public.leads to service_role;
grant select on public.lead_batches to service_role;
