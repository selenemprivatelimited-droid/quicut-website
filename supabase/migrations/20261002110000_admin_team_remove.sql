-- Lets a founder remove an admin. Run once in the Supabase SQL editor (the assistant's tool refuses statements that delete rows).
-- Rules: founders only, never yourself, and at least one other founder must remain.
create or replace function private.admin_team_remove(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_admin()) then raise exception 'Admins only'; end if;
  if (select role from public.admins where email = lower((select auth.jwt()) ->> 'email')) is distinct from 'founder' then
    raise exception 'Only a founder can remove admins';
  end if;
  if lower(trim(p_email)) = lower((select auth.jwt()) ->> 'email') then raise exception 'You cannot remove yourself'; end if;
  if (select count(*) from public.admins where role = 'founder' and email <> lower(trim(p_email))) < 1 then
    raise exception 'At least one founder must remain';
  end if;
  delete from public.admins where email = lower(trim(p_email));
end $$;

create or replace function public.admin_team_remove(p_email text)
returns void language sql set search_path = '' as $$ select private.admin_team_remove(p_email) $$;

revoke all on function private.admin_team_remove(text) from public, anon;
revoke all on function public.admin_team_remove(text) from public, anon;
grant execute on function public.admin_team_remove(text) to authenticated;
