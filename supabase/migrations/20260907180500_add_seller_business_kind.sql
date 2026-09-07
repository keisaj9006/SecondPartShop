alter table public.sellers
  add column if not exists business_kind text;

alter table public.sellers
  drop constraint if exists sellers_business_kind_check;

alter table public.sellers
  add constraint sellers_business_kind_check
  check (
    business_kind is null
    or business_kind = any(array[
      'breaker'::text,
      'garage'::text,
      'atf'::text,
      'parts_business'::text,
      'other'::text
    ])
  );

create index if not exists sellers_business_kind_idx
  on public.sellers(business_kind,id)
  where business_kind is not null;

create or replace function private.protect_seller_verification()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  identity_changed boolean;
begin
  if private.is_admin() then return new; end if;

  identity_changed:=
    new.business_name is distinct from old.business_name
    or new.seller_type is distinct from old.seller_type
    or new.business_kind is distinct from old.business_kind
    or new.location is distinct from old.location
    or new.postcode is distinct from old.postcode;

  if new.verified_at is distinct from old.verified_at and new.verified_at is not null then
    raise exception 'Only administrators can grant seller verification.';
  end if;

  if identity_changed then new.verified_at:=null; else new.verified_at:=old.verified_at; end if;
  return new;
end;
$$;

create or replace function private.cancel_pending_seller_verification_on_identity_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if
    new.business_name is distinct from old.business_name
    or new.seller_type is distinct from old.seller_type
    or new.business_kind is distinct from old.business_kind
    or new.location is distinct from old.location
    or new.postcode is distinct from old.postcode
  then
    update public.seller_verification_requests
    set status='cancelled',
        reviewed_at=now(),
        review_note='Seller identity details changed after this verification request was submitted.'
    where seller_id=new.id and status='pending';
  end if;
  return new;
end;
$$;

drop trigger if exists seller_identity_change_cancels_pending_verification on public.sellers;
create trigger seller_identity_change_cancels_pending_verification
after update of business_name,seller_type,business_kind,location,postcode
on public.sellers
for each row
execute function private.cancel_pending_seller_verification_on_identity_change();
