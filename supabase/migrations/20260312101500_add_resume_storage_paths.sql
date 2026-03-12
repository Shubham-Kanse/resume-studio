alter table public.tracked_runs
  add column if not exists resume_file_path text;

alter table public.job_applications
  add column if not exists resume_file_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'resume-files',
  'resume-files',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'application/json'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their own resume files" on storage.objects;
create policy "Users can read their own resume files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resume-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can upload their own resume files" on storage.objects;
create policy "Users can upload their own resume files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'resume-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update their own resume files" on storage.objects;
create policy "Users can update their own resume files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'resume-files'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'resume-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete their own resume files" on storage.objects;
create policy "Users can delete their own resume files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'resume-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);
