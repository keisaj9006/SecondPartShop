create or replace function private.protect_seller_verification()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  identity_changed boolean;
begin
  if private.is_admin() then
    return new;
  end if;

  if tg_op='INSERT' then
    new.verified_at:=null;
    return new;
  end if;

  identity_changed:=
    new.business_name is distinct from old.business_name
    or new.seller_type is distinct from old.seller_type
    or new.business_kind is distinct from old.business_kind
    or new.location is distinct from old.location
    or new.postcode is distinct from old.postcode;

  if new.verified_at is distinct from old.verified_at
     and new.verified_at is not null then
    raise exception 'Only administrators can grant seller verification.';
  end if;

  if identity_changed then
    new.verified_at:=null;
  else
    new.verified_at:=old.verified_at;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_seller_verification_trigger on public.sellers;
create trigger protect_seller_verification_trigger
before insert or update on public.sellers
for each row
execute function private.protect_seller_verification();
