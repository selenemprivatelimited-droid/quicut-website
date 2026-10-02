-- Support tickets: creators and editors write to the QuiCut team, admins reply.
-- Already applied to the live database; this file records it. Writes go through functions, reads through RLS.

create table if not exists public.tickets (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  order_code text,
  subject text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.tickets(id) on delete cascade,
  author_id uuid not null default auth.uid(),
  from_admin boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

create policy "own tickets" on public.tickets for select
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "own ticket messages" on public.ticket_messages for select
  using (exists (select 1 from public.tickets t where t.id = ticket_messages.ticket_id and (t.user_id = (select auth.uid()) or (select private.is_admin()))));

-- private security-definer functions with public invoker wrappers
create or replace function private.ticket_create(p_subject text, p_body text, p_order text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare tid bigint;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in'; end if;
  if (select count(*) from public.tickets where user_id = (select auth.uid()) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many requests. Try again in an hour.';
  end if;
  insert into public.tickets(user_id, subject, order_code) values ((select auth.uid()), left(trim(p_subject),120), nullif(trim(coalesce(p_order,'')),'')) returning id into tid;
  insert into public.ticket_messages(ticket_id, author_id, from_admin, body) values (tid, (select auth.uid()), false, left(trim(p_body),4000));
  return tid;
end $$;

create or replace function private.ticket_reply(p_ticket bigint, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare adm boolean := (select private.is_admin());
begin
  if not exists (select 1 from public.tickets t where t.id = p_ticket and (t.user_id = (select auth.uid()) or adm)) then
    raise exception 'Ticket not found';
  end if;
  insert into public.ticket_messages(ticket_id, author_id, from_admin, body) values (p_ticket, (select auth.uid()), adm, left(trim(p_body),4000));
  update public.tickets set updated_at = now(), status = case when adm then 'pending' else 'open' end where id = p_ticket;
end $$;

create or replace function private.ticket_set_status(p_ticket bigint, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_admin()) then raise exception 'Admins only'; end if;
  if p_status not in ('open','pending','solved') then raise exception 'Unknown status'; end if;
  update public.tickets set status = p_status, updated_at = now() where id = p_ticket;
end $$;

create or replace function public.ticket_create(p_subject text, p_body text, p_order text default null)
returns bigint language sql set search_path = '' as $$ select private.ticket_create(p_subject, p_body, p_order) $$;
create or replace function public.ticket_reply(p_ticket bigint, p_body text)
returns void language sql set search_path = '' as $$ select private.ticket_reply(p_ticket, p_body) $$;
create or replace function public.ticket_set_status(p_ticket bigint, p_status text)
returns void language sql set search_path = '' as $$ select private.ticket_set_status(p_ticket, p_status) $$;
