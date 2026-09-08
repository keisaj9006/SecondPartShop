create or replace function private.protect_seller_verification()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  identity_changed boolean;
begin
  if current_user in ('postgres','service_role') or private.is_admin() then
    return new;
  end if;

  if tg_op='INSERT' then
    new.verified_at:=null;
    new.latitude:=null;
    new.longitude:=null;
    new.postcode_geocode_approximate:=false;
    new.postcode_geocoded_at:=null;
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

  new.latitude:=old.latitude;
  new.longitude:=old.longitude;
  new.postcode_geocode_approximate:=old.postcode_geocode_approximate;
  new.postcode_geocoded_at:=old.postcode_geocoded_at;

  if identity_changed then
    new.verified_at:=null;
  else
    new.verified_at:=old.verified_at;
  end if;

  return new;
end;
$$;
