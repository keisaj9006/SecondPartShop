create or replace function private.protect_garage_partner_review()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  identity_changed boolean;
begin
  if current_user='service_role' or private.is_admin() then
    return new;
  end if;

  if tg_op='INSERT' then
    new.status:='pending';
    new.verified_at:=null;
    new.latitude:=null;
    new.longitude:=null;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Garage ownership cannot be changed.';
  end if;
  if new.status is distinct from old.status then
    raise exception 'Only administrators can change garage partner review status.';
  end if;
  if new.verified_at is distinct from old.verified_at then
    raise exception 'Only administrators can change garage verification.';
  end if;

  new.latitude:=old.latitude;
  new.longitude:=old.longitude;

  identity_changed:=
    new.business_name is distinct from old.business_name
    or new.location is distinct from old.location
    or new.postcode is distinct from old.postcode;

  if identity_changed and (old.status='active' or old.verified_at is not null) then
    new.status:='pending';
    new.verified_at:=null;
  end if;

  return new;
end;
$$;

drop trigger if exists garage_partners_protect_review on public.garage_partners;
create trigger garage_partners_protect_review
before insert or update on public.garage_partners
for each row
execute function private.protect_garage_partner_review();

drop trigger if exists guard_garage_partner_system_fields_trigger on public.garage_partners;
drop function if exists private.guard_garage_partner_system_fields();

drop trigger if exists reset_garage_verification_on_identity_change_trigger on public.garage_partners;
drop function if exists private.reset_garage_verification_on_identity_change();
