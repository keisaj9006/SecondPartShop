create or replace function private.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.role is distinct from old.role then
    if old.role='buyer'::public.user_role
       and new.role='seller'::public.user_role
       and old.id=(select auth.uid())
       and new.id=old.id then
      return new;
    end if;

    if not private.is_admin() then
      raise exception 'Only administrators can change account roles';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.upgrade_account_to_seller()
returns boolean
language plpgsql
security invoker
set search_path=''
as $$
declare
  changed boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
     set role='seller'::public.user_role
   where id=(select auth.uid())
     and role='buyer'::public.user_role;

  changed=found;

  if not changed and exists(
    select 1
      from public.profiles
     where id=(select auth.uid())
       and role in ('seller'::public.user_role,'admin'::public.user_role)
  ) then
    return true;
  end if;

  return changed;
end;
$$;

revoke all on function public.upgrade_account_to_seller() from public;
grant execute on function public.upgrade_account_to_seller() to authenticated;
