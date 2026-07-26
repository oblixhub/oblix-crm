-- One Instagram profile represents one lead, regardless of capitalization or
-- whether a collaborator imports it from another batch at the same time.
-- This intentionally fails safely if legacy duplicates exist, so no lead data
-- is silently discarded during the migration.
create unique index if not exists leads_handle_normalized_unique_idx
  on public.leads ((lower(btrim(handle))))
  where handle is not null and btrim(handle) <> '';

-- Keep the contact found in a public Instagram bio/link available to the team.
alter table public.leads
  add column if not exists whatsapp_url text;
