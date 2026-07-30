alter table public.leads
  add column if not exists preview_requires_login boolean not null default false;
