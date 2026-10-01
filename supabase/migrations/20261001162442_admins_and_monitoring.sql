-- Admin allow-list (1 to 10 people) and a private helper used by RLS.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;

create table public.admins (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  ) and (select auth.uid()) is not null
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

create policy "admins see the admin list" on public.admins
  for select to authenticated using ((select private.is_admin()));

insert into public.admins (email) values
  ('selenemprivatelimited@gmail.com'),
  ('runovahtechnologies@gmail.com');

-- Real-time error tracking + APM (Sentry-style), written by the browser, read only by admins.
create table public.monitor_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('error', 'unhandled', 'http', 'vital', 'console', 'event')),
  level text not null default 'error' check (level in ('error', 'warn', 'info')),
  message text not null check (char_length(message) between 1 and 1000),
  stack text check (char_length(stack) <= 6000),
  page text check (char_length(page) <= 40),
  url text check (char_length(url) <= 500),
  release text check (char_length(release) <= 40),
  session_id text check (char_length(session_id) <= 64),
  fingerprint text check (char_length(fingerprint) <= 64),
  ua text check (char_length(ua) <= 400),
  value double precision,
  meta jsonb check (meta is null or pg_column_size(meta) <= 4000)
);
create index monitor_events_created_at_idx on public.monitor_events (created_at desc);
create index monitor_events_fingerprint_idx on public.monitor_events (fingerprint, created_at desc);
alter table public.monitor_events enable row level security;
revoke all on public.monitor_events from anon, authenticated;
grant insert on public.monitor_events to anon, authenticated;
grant select on public.monitor_events to authenticated;

create policy "anyone can report an event" on public.monitor_events
  for insert to anon, authenticated
  with check (created_at > now() - interval '5 minutes' and created_at < now() + interval '5 minutes');
create policy "admins read events" on public.monitor_events
  for select to authenticated using ((select private.is_admin()));

alter publication supabase_realtime add table public.monitor_events;
