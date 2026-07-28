begin;

create table public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  title text not null,
  slug text not null,
  category text not null default 'Site',
  short_description text not null default '',
  description text not null default '',
  services text[] not null default '{}',
  source_type text not null default 'standalone_zip',
  source_path text,
  public_key uuid not null default gen_random_uuid(),
  current_version integer not null default 0 check (current_version >= 0),
  content_url text,
  cover_desktop_path text,
  cover_mobile_path text,
  live_url text,
  show_live_link boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 0,
  status text not null default 'draft',
  publication_authorized boolean not null default false,
  authorization_note text not null default '',
  created_by uuid references public.profiles(user_id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_projects_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint portfolio_projects_source_type_check
    check (source_type in ('lead_preview', 'standalone_zip')),
  constraint portfolio_projects_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint portfolio_projects_live_url_check
    check (
      live_url is null
      or live_url ~* '^https://'
    )
);

create unique index portfolio_projects_slug_unique_idx
  on public.portfolio_projects (lower(slug));

create unique index portfolio_projects_public_key_unique_idx
  on public.portfolio_projects (public_key);

create index portfolio_projects_public_listing_idx
  on public.portfolio_projects (featured desc, sort_order asc, published_at desc)
  where status = 'published';

create index portfolio_projects_lead_idx
  on public.portfolio_projects (lead_id)
  where lead_id is not null;

create table public.portfolio_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  version integer not null check (version > 0),
  storage_prefix text not null,
  entrypoint text not null,
  source_path text not null,
  published_by uuid references public.profiles(user_id) on delete set null,
  published_at timestamptz not null default now(),
  unique (project_id, version)
);

create index portfolio_versions_project_idx
  on public.portfolio_versions (project_id, version desc);

alter table public.portfolio_projects enable row level security;
alter table public.portfolio_versions enable row level security;

create policy portfolio_projects_owner_select
  on public.portfolio_projects for select
  to authenticated
  using (private.is_owner());

create policy portfolio_projects_owner_insert
  on public.portfolio_projects for insert
  to authenticated
  with check (
    private.is_owner()
    and created_by = (select auth.uid())
  );

create policy portfolio_projects_owner_update
  on public.portfolio_projects for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

create policy portfolio_projects_owner_delete
  on public.portfolio_projects for delete
  to authenticated
  using (private.is_owner());

create policy portfolio_versions_owner_select
  on public.portfolio_versions for select
  to authenticated
  using (private.is_owner());

create policy portfolio_versions_owner_insert
  on public.portfolio_versions for insert
  to authenticated
  with check (
    private.is_owner()
    and published_by = (select auth.uid())
  );

create policy portfolio_versions_owner_delete
  on public.portfolio_versions for delete
  to authenticated
  using (private.is_owner());

grant select, insert, update, delete
  on public.portfolio_projects
  to authenticated;

grant select, insert, delete
  on public.portfolio_versions
  to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'portfolio-zips',
    'portfolio-zips',
    false,
    20971520,
    array[
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream'
    ]
  ),
  (
    'portfolio-sites',
    'portfolio-sites',
    false,
    20971520,
    null
  ),
  (
    'portfolio-covers',
    'portfolio-covers',
    true,
    8388608,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif'
    ]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "owners can read portfolio source files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('portfolio-zips', 'portfolio-covers')
    and private.is_owner()
  );

create policy "owners can upload portfolio source files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('portfolio-zips', 'portfolio-covers')
    and private.is_owner()
  );

create policy "owners can update portfolio source files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('portfolio-zips', 'portfolio-covers')
    and private.is_owner()
  )
  with check (
    bucket_id in ('portfolio-zips', 'portfolio-covers')
    and private.is_owner()
  );

create policy "owners can delete portfolio source files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('portfolio-zips', 'portfolio-covers')
    and private.is_owner()
  );

commit;
