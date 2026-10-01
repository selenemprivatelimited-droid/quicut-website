-- QuiCut marketplace data. Users read their own rows; admins read everything.
-- Money and credit changes are written only by the server (payment webhooks / edge functions with the secret key).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('creator', 'editor')),
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 20),
  region text not null default 'IN' check (region in ('IN', 'GLOBAL')),
  upi_id text check (char_length(upi_id) <= 80),
  kyc_status text not null default 'none' check (kyc_status in ('none', 'pending', 'verified', 'rejected')),
  editor_status text check (editor_status in ('trial', 'active', 'paused', 'removed')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, role, full_name, phone, region) on public.profiles to authenticated;
grant update (full_name, phone, region, upi_id) on public.profiles to authenticated;
create policy "own profile or admin" on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select private.is_admin()));
create policy "create own profile" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "edit own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create table public.orders (
  id bigint generated always as identity primary key,
  code text not null unique,
  creator_id uuid not null references public.profiles (id),
  editor_id uuid references public.profiles (id),
  edit_type text not null,
  addons text[] not null default '{}',
  credits integer not null check (credits > 0),
  editor_pay_inr numeric(10, 2) not null default 0,
  status text not null default 'placed' check (status in ('placed', 'assigned', 'in_progress', 'review', 'revision', 'completed', 'refunded', 'cancelled')),
  brief jsonb,
  deadline timestamptz,
  revisions integer not null default 0,
  stars smallint check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index orders_creator_idx on public.orders (creator_id, created_at desc);
create index orders_editor_idx on public.orders (editor_id, created_at desc);
create index orders_status_idx on public.orders (status);
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
create policy "parties or admin read orders" on public.orders for select to authenticated
  using ((select auth.uid()) = creator_id or (select auth.uid()) = editor_id or (select private.is_admin()));

create table public.payments (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  provider text not null check (provider in ('razorpay', 'stripe', 'manual')),
  provider_ref text not null unique,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null check (currency in ('INR', 'USD')),
  credits integer not null check (credits >= 0),
  status text not null default 'paid' check (status in ('created', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id, created_at desc);
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create policy "own payments or admin" on public.payments for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('purchase', 'order', 'refund', 'bonus', 'adjustment')),
  order_id bigint references public.orders (id),
  payment_id bigint references public.payments (id),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);
create index credit_ledger_order_idx on public.credit_ledger (order_id);
create index credit_ledger_payment_idx on public.credit_ledger (payment_id);
alter table public.credit_ledger enable row level security;
revoke all on public.credit_ledger from anon, authenticated;
grant select on public.credit_ledger to authenticated;
create policy "own ledger or admin" on public.credit_ledger for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

create table public.payouts (
  id bigint generated always as identity primary key,
  editor_id uuid not null references public.profiles (id),
  amount_inr numeric(10, 2) not null check (amount_inr > 0),
  status text not null default 'requested' check (status in ('requested', 'processing', 'paid', 'failed')),
  reference text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payouts_editor_idx on public.payouts (editor_id, requested_at desc);
alter table public.payouts enable row level security;
revoke all on public.payouts from anon, authenticated;
grant select on public.payouts to authenticated;
create policy "own payouts or admin" on public.payouts for select to authenticated
  using ((select auth.uid()) = editor_id or (select private.is_admin()));

-- Balance view that respects the caller's RLS.
create view public.credit_balances with (security_invoker = true) as
  select user_id, sum(delta)::integer as balance from public.credit_ledger group by user_id;
grant select on public.credit_balances to authenticated;
