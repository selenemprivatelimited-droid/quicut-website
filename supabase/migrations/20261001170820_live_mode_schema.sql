-- Prices live in the database so the server, not the browser, decides what an order costs.
create table public.edit_types (
  id text primary key,
  name text not null,
  credits integer not null check (credits > 0),
  editor_pay_inr integer not null check (editor_pay_inr >= 0),
  hours integer not null check (hours > 0),
  sort smallint not null default 0
);
create table public.addons (
  id text primary key,
  name text not null,
  credits integer not null check (credits > 0),
  editor_pay_inr integer not null check (editor_pay_inr >= 0)
);
alter table public.edit_types enable row level security;
alter table public.addons enable row level security;
revoke all on public.edit_types, public.addons from anon, authenticated;
grant select on public.edit_types, public.addons to anon, authenticated;
create policy "prices are public" on public.edit_types for select to anon, authenticated using (true);
create policy "addon prices are public" on public.addons for select to anon, authenticated using (true);
insert into public.edit_types (id, name, credits, editor_pay_inr, hours, sort) values
  ('reel', 'Reel / Short', 299, 239, 12, 1),
  ('vlog', 'Standard Vlog', 499, 399, 24, 2),
  ('gaming', 'Gaming Montage', 799, 639, 24, 3),
  ('cinematic', 'Premium Cinematic', 1199, 959, 48, 4),
  ('wedding', 'Wedding / Event', 2499, 1999, 72, 5);
insert into public.addons (id, name, credits, editor_pay_inr) values
  ('express', 'Express 12-hour', 199, 159),
  ('captions', 'Subtitles / captions', 99, 79),
  ('thumb', 'Thumbnail design', 199, 159),
  ('motion', 'Motion graphics pack', 349, 279),
  ('revision', 'Extra revision', 149, 119),
  ('raw', 'Raw project files', 49, 39);

-- Profile details the app shows.
alter table public.profiles
  add column handle text check (char_length(handle) <= 60),
  add column lang text check (char_length(lang) <= 30),
  add column city text check (char_length(city) <= 60),
  add column skills text[] not null default '{}',
  add column rating numeric(3, 2) not null default 0,
  add column ratings integer not null default 0,
  add column kyc_doc_type text check (char_length(kyc_doc_type) <= 40),
  add column kyc_doc_last4 text check (char_length(kyc_doc_last4) <= 12),
  add column kyc_pan_last4 text check (char_length(kyc_pan_last4) <= 12),
  add column kyc_upi text check (char_length(kyc_upi) <= 80),
  add column kyc_legal_name text check (char_length(kyc_legal_name) <= 120),
  add column kyc_note text check (char_length(kyc_note) <= 200),
  add column kyc_submitted_at timestamptz,
  add column kyc_reviewed_at timestamptz;
grant insert (handle, lang, city, skills) on public.profiles to authenticated;
grant update (handle, lang, city, skills) on public.profiles to authenticated;

-- Orders: what the screens need. Names are copied in so creators and editors never need
-- to read each other's private profile. (DB statuses: placed, in_progress, review, revision,
-- completed, refunded; the app maps placed -> paid and in_progress -> editing.)
alter table public.orders
  add column title text not null default '' check (char_length(title) <= 120),
  add column brief_text text check (char_length(brief_text) <= 3000),
  add column footage text check (char_length(footage) <= 200),
  add column checklist jsonb check (checklist is null or pg_column_size(checklist) <= 8000),
  add column done jsonb not null default '{}'::jsonb,
  add column delivery_url text check (char_length(delivery_url) <= 500),
  add column revision_note text check (char_length(revision_note) <= 600),
  add column refund_reason text check (char_length(refund_reason) <= 200),
  add column creator_name text,
  add column creator_handle text,
  add column creator_lang text,
  add column editor_name text,
  add column editor_city text,
  add column editor_rating numeric(3, 2),
  add column history jsonb not null default '[]'::jsonb;

create table public.earnings (
  id bigint generated always as identity primary key,
  editor_id uuid not null references public.profiles (id),
  order_id bigint not null unique references public.orders (id),
  amount_inr numeric(10, 2) not null check (amount_inr > 0),
  created_at timestamptz not null default now()
);
create index earnings_editor_idx on public.earnings (editor_id, created_at desc);
alter table public.earnings enable row level security;
revoke all on public.earnings from anon, authenticated;
grant select on public.earnings to authenticated;
create policy "own earnings or admin" on public.earnings for select to authenticated
  using ((select auth.uid()) = editor_id or (select private.is_admin()));

create table public.order_messages (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  sender_role text not null check (sender_role in ('creator', 'editor', 'admin')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index order_messages_order_idx on public.order_messages (order_id, created_at);
create index order_messages_sender_idx on public.order_messages (sender_id);
alter table public.order_messages enable row level security;
revoke all on public.order_messages from anon, authenticated;
grant select on public.order_messages to authenticated;

create table public.deletion_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  status text not null default 'requested' check (status in ('requested', 'done')),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index deletion_requests_user_idx on public.deletion_requests (user_id);
alter table public.deletion_requests enable row level security;
revoke all on public.deletion_requests from anon, authenticated;
grant select on public.deletion_requests to authenticated;
create policy "own deletion request or admin" on public.deletion_requests for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

-- Helper: is the caller a verified, active editor? (used to show open jobs)
create or replace function private.is_active_editor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'editor' and p.kyc_status = 'verified' and coalesce(p.editor_status, 'active') = 'active'
  )
$$;
revoke all on function private.is_active_editor() from public;
grant execute on function private.is_active_editor() to authenticated;

-- Extra permissive policy: verified editors can see open jobs.
create policy "editors see open jobs" on public.orders for select to authenticated
  using (status = 'placed' and editor_id is null and (select private.is_active_editor()));

create policy "order parties read messages" on public.order_messages for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id
      and ((select auth.uid()) in (o.creator_id, o.editor_id) or (select private.is_admin()))
  ));
