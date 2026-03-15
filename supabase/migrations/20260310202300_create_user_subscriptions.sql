create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'inactive' check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled')),
  billing_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_subscriptions_plan_status_idx
  on public.user_subscriptions (plan, status);

create unique index if not exists user_subscriptions_provider_subscription_id_idx
  on public.user_subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;

create unique index if not exists user_subscriptions_provider_customer_id_idx
  on public.user_subscriptions (provider_customer_id)
  where provider_customer_id is not null;

create or replace function public.set_user_subscriptions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists user_subscriptions_set_updated_at on public.user_subscriptions;

create trigger user_subscriptions_set_updated_at
before update on public.user_subscriptions
for each row
execute function public.set_user_subscriptions_updated_at();

create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_subscriptions (user_id, email, plan, status)
  values (new.id, new.email, 'free', 'inactive')
  on conflict (user_id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
drop trigger if exists on_auth_user_subscription_sync on auth.users;

create trigger on_auth_user_subscription_sync
after insert or update of email on auth.users
for each row
execute function public.handle_new_user_subscription();

insert into public.user_subscriptions (user_id, email, plan, status)
select id, email, 'free', 'inactive'
from auth.users
on conflict (user_id) do update
set email = excluded.email;

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users can read their own subscription" on public.user_subscriptions;
create policy "Users can read their own subscription"
on public.user_subscriptions
for select
using (auth.uid() = user_id);
