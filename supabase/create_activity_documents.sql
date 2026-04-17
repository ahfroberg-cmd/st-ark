-- Dokument + intygsgrupp (ST-ARK)
-- Kör i Supabase SQL editor.

-- 1) Intygsgrupp på placeringar (för sammanslagna intyg)
alter table public.placements
  add column if not exists intyg_group integer;

-- 2) Dokumentmetadata
create table if not exists public.activity_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  activity_kind text null check (activity_kind in ('placement', 'course')),
  activity_id text null,
  file_path text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.activity_documents enable row level security;

drop policy if exists "activity_documents_owner_select" on public.activity_documents;
create policy "activity_documents_owner_select"
  on public.activity_documents
  for select
  using (auth.uid() = user_id);

drop policy if exists "activity_documents_owner_insert" on public.activity_documents;
create policy "activity_documents_owner_insert"
  on public.activity_documents
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "activity_documents_owner_update" on public.activity_documents;
create policy "activity_documents_owner_update"
  on public.activity_documents
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "activity_documents_owner_delete" on public.activity_documents;
create policy "activity_documents_owner_delete"
  on public.activity_documents
  for delete
  using (auth.uid() = user_id);

-- 3) Storage bucket för dokumentfiler
insert into storage.buckets (id, name, public)
values ('activity-documents', 'activity-documents', false)
on conflict (id) do nothing;

drop policy if exists "activity_documents_storage_select" on storage.objects;
create policy "activity_documents_storage_select"
  on storage.objects
  for select
  using (
    bucket_id = 'activity-documents'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "activity_documents_storage_insert" on storage.objects;
create policy "activity_documents_storage_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'activity-documents'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "activity_documents_storage_update" on storage.objects;
create policy "activity_documents_storage_update"
  on storage.objects
  for update
  using (
    bucket_id = 'activity-documents'
    and auth.uid()::text = split_part(name, '/', 1)
  )
  with check (
    bucket_id = 'activity-documents'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "activity_documents_storage_delete" on storage.objects;
create policy "activity_documents_storage_delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'activity-documents'
    and auth.uid()::text = split_part(name, '/', 1)
  );
