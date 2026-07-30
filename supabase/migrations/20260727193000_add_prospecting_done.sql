alter table public.leads
  add column if not exists prospecting_done boolean not null default false;
