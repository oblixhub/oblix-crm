alter table public.leads
  add column if not exists preview_url text,
  add column if not exists preview_file_name text,
  add column if not exists preview_version integer,
  add column if not exists preview_published_at timestamptz;
