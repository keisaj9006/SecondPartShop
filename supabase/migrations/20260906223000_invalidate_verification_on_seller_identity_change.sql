-- Keep the verified-business badge tied to the identity that was actually reviewed.
-- Sellers may edit their own public profile, but changing identity-critical fields
-- automatically invalidates the previous verification. Only admins can grant it.

create or replace function private.protect_seller_verification()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  critical_identity_changed boolean;
  requested_verification_change boolean;
begin
  critical_identity_changed :=
    new.business_name is distinct from old.business_name
    or new.seller_type is distinct from old.seller_type
    or new.location is distinct from old.location
    or new.postcode is distinct from old.postcode;

  requested_verification_change := new.verified_at is distinct from old.verified_at;

  if not private.is_admin() then
    if requested_verification_change
       and not (
         old.verified_at is not null
         and new.verified_at is null
         and critical_identity_changed
       ) then
      raise exception 'Only administrators can change seller verification status.';
    end if;

    if critical_identity_changed and old.verified_at is not null then
      new.verified_at := null;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_seller_verification() from public;
