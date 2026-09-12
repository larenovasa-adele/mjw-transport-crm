-- Adds support for: (1) drivers logging a dashboard/odometer photo at the
-- start and end of a trip, and (2) the storage bucket + policies that photo
-- upload needs. Run this in the SQL Editor after 0001_init.sql, on the same
-- project you already ran 0001 on.

alter table trips add column if not exists start_photo_url text;
alter table trips add column if not exists end_photo_url text;

-- Storage bucket the driver photo uploads go into. Public so the CRM can
-- display them via a plain URL (no signed-URL plumbing needed for v1).
insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', true)
on conflict (id) do nothing;

-- Match the rest of this app's security model: any authenticated user
-- (owner, dispatcher, driver, etc.) can read/upload trip photos.
drop policy if exists "Authenticated can read trip photos" on storage.objects;
create policy "Authenticated can read trip photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'trip-photos');

drop policy if exists "Authenticated can upload trip photos" on storage.objects;
create policy "Authenticated can upload trip photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'trip-photos');

drop policy if exists "Authenticated can update trip photos" on storage.objects;
create policy "Authenticated can update trip photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'trip-photos');
