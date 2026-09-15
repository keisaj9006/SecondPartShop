create or replace function private.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  request_role text:=(select auth.jwt()->>'role');
begin
  if new.role is distinct from old.role then
    if old.role='buyer'::public.user_role
       and new.role='seller'::public.user_role
       and old.id=(select auth.uid())
       and new.id=old.id then
      return new;
    end if;

    if request_role='service_role' or private.is_admin() then
      return new;
    end if;

    raise exception 'Only administrators can change account roles';
  end if;

  return new;
end;
$$;
