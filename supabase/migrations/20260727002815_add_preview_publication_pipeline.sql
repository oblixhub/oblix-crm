alter table public.leads
  add column if not exists preview_slug text,
  add column if not exists preview_site_url text,
  add column if not exists preview_source_path text;

create unique index if not exists leads_preview_slug_unique
  on public.leads (preview_slug)
  where preview_slug is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'preview-zips',
    'preview-zips',
    false,
    20971520,
    array['application/zip', 'application/x-zip-compressed']::text[]
  ),
  (
    'preview-sites',
    'preview-sites',
    true,
    52428800,
    null
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'crm team can upload preview zips'
  ) then
    create policy "crm team can upload preview zips"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'preview-zips');
  end if;
end
$$;

update public.leads
set
  preview_slug = 'leticia-preview-20260727',
  preview_site_url = 'https://oblix-crm.vercel.app/previews/leticia-preview-20260727/site.html'
where lower(handle) = '@letnutri_'
  and preview_slug is null;
