-- ============================================================
-- Cut Tracker — database setup
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once.
-- ============================================================

-- One row per logged day.
create table if not exists public.days (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date    text not null,
  data    jsonb not null default '{}'::jsonb,
  updated bigint not null default 0,
  primary key (user_id, date)
);

-- One row per user: settings, custom foods, favorites, saved meals.
create table if not exists public.profile (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data    jsonb not null default '{}'::jsonb,
  updated bigint not null default 0
);

-- Row level security: every user can only ever see and change their own rows.
alter table public.days    enable row level security;
alter table public.profile enable row level security;

drop policy if exists days_own    on public.days;
drop policy if exists profile_own on public.profile;

create policy days_own on public.days
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy profile_own on public.profile
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Makes the sync query fast once there are a few hundred days.
create index if not exists days_user_updated_idx on public.days (user_id, updated);
