create or replace function private.reset_garage_verification_on_identity_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if (
    old.business_name is distinct from new.business_name
    or old.location is distinct from new.location
    or old.postcode is distinct from new.postcode
  ) and (old.status='active' or old.verified_at is not null) then
    new.status:='pending';
    new.verified_at:=null;
    new.updated_at:=now();
  end if;
  return new;
end;
$$;

drop trigger if exists reset_garage_verification_on_identity_change_trigger on public.garage_partners;
create trigger reset_garage_verification_on_identity_change_trigger
before update on public.garage_partners
for each row
execute function private.reset_garage_verification_on_identity_change();
