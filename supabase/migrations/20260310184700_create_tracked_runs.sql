create table if not exists public.tracked_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('generate', 'ats-score')),
  label text not null,
  job_description text,
  resume_content text not null,
  resume_file_name text,
  resume_file_mime_type text,
  resume_file_data_url text,
  extra_instructions text,
  latex_content text,
  ats_score jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.tracked_runs
  add column if not exists resume_file_name text,
  add column if not exists resume_file_mime_type text,
  add column if not exists resume_file_data_url text;

create index if not exists tracked_runs_user_created_at_idx
  on public.tracked_runs (user_id, created_at desc);

create or replace function public.set_tracked_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists tracked_runs_set_updated_at on public.tracked_runs;

create trigger tracked_runs_set_updated_at
before update on public.tracked_runs
for each row
execute function public.set_tracked_runs_updated_at();

alter table public.tracked_runs enable row level security;

drop policy if exists "Users can read their own tracked runs" on public.tracked_runs;
create policy "Users can read their own tracked runs"
on public.tracked_runs
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own tracked runs" on public.tracked_runs;
create policy "Users can insert their own tracked runs"
on public.tracked_runs
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tracked runs" on public.tracked_runs;
create policy "Users can update their own tracked runs"
on public.tracked_runs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own tracked runs" on public.tracked_runs;
create policy "Users can delete their own tracked runs"
on public.tracked_runs
for delete
using (auth.uid() = user_id);
