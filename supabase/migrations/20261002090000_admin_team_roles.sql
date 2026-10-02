-- Admin team roles: each admin has a role that decides which sections of the panel they see.
-- Only a founder can add people or change roles (max 10 admins). Removing an admin is done by a founder in the dashboard.
alter table public.admins add column if not exists role text not null default 'founder';
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('founder','support','quality','editor_ops','finance','growth'));

create or replace function private.is_founder() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.email = lower(coalesce((select auth.jwt()) ->> 'email','')) and a.role = 'founder')
    and (select auth.uid()) is not null
$$;
revoke all on function private.is_founder() from public, anon;
grant execute on function private.is_founder() to authenticated;

create or replace function private.admin_team_set(p_email text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare e text := lower(trim(p_email));
begin
  if not private.is_founder() then raise exception 'Only a founder can change the team'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
  if p_role not in ('founder','support','quality','editor_ops','finance','growth') then raise exception 'Unknown role'; end if;
  if not exists (select 1 from public.admins where email = e) and (select count(*) from public.admins) >= 10 then
    raise exception 'The admin team is limited to 10 people';
  end if;
  if p_role <> 'founder' and (select role from public.admins where email = e) = 'founder'
     and (select count(*) from public.admins where role = 'founder') <= 1 then
    raise exception 'Keep at least one founder';
  end if;
  insert into public.admins(email, role) values (e, p_role)
    on conflict (email) do update set role = excluded.role;
end $$;

create or replace function public.admin_team_set(p_email text, p_role text) returns void
language sql security invoker set search_path = '' as $$ select private.admin_team_set(p_email, p_role) $$;
revoke all on function private.admin_team_set(text,text) from public, anon;
revoke all on function public.admin_team_set(text,text) from public, anon;
grant execute on function private.admin_team_set(text,text), public.admin_team_set(text,text) to authenticated;
