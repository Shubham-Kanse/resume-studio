create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company text not null,
  position text,
  stage text not null check (stage in ('Applied', 'Interview', 'Offer', 'Rejected', 'No Answer')),
  job_link text,
  resume_file_name text,
  resume_file_mime_type text,
  resume_file_data_url text,
  applied_on date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.job_applications
  add column if not exists resume_file_name text,
  add column if not exists resume_file_mime_type text,
  add column if not exists resume_file_data_url text;

create index if not exists job_applications_user_applied_on_idx
  on public.job_applications (user_id, applied_on desc, updated_at desc);

create or replace function public.set_job_applications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists job_applications_set_updated_at on public.job_applications;

create trigger job_applications_set_updated_at
before update on public.job_applications
for each row
execute function public.set_job_applications_updated_at();

alter table public.job_applications enable row level security;

drop policy if exists "Users can read their own job applications" on public.job_applications;
create policy "Users can read their own job applications"
on public.job_applications
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own job applications" on public.job_applications;
create policy "Users can insert their own job applications"
on public.job_applications
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own job applications" on public.job_applications;
create policy "Users can update their own job applications"
on public.job_applications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own job applications" on public.job_applications;
create policy "Users can delete their own job applications"
on public.job_applications
for delete
using (auth.uid() = user_id);
