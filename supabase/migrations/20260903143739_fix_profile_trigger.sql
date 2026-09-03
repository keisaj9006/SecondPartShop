create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.user_role;
  requested_name text;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'role' = 'seller' then 'seller'::public.user_role
    else 'buyer'::public.user_role
  end;

  requested_name := coalesce(
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(pg_catalog.split_part(new.email, '@', 1), ''),
    'SecondPart member'
  );

  if pg_catalog.char_length(requested_name) not between 2 and 100 then
    requested_name := 'SecondPart member';
  end if;

  insert into public.profiles(id,role,display_name)
  values(new.id,requested_role,requested_name);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

