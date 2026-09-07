alter table public.seller_verification_requests
  add column if not exists legal_business_name text,
  add column if not exists business_reference text,
  add column if not exists reference_url text,
  add column if not exists business_name_snapshot text,
  add column if not exists seller_type_snapshot text,
  add column if not exists business_kind_snapshot text,
  add column if not exists location_snapshot text,
  add column if not exists postcode_snapshot text;

alter table public.seller_verification_requests
  drop constraint if exists seller_verification_legal_name_check,
  drop constraint if exists seller_verification_reference_check,
  drop constraint if exists seller_verification_reference_url_check;

alter table public.seller_verification_requests
  add constraint seller_verification_legal_name_check
  check (legal_business_name is null or char_length(btrim(legal_business_name)) between 2 and 180),
  add constraint seller_verification_reference_check
  check (business_reference is null or char_length(btrim(business_reference)) between 2 and 180),
  add constraint seller_verification_reference_url_check
  check (reference_url is null or (char_length(reference_url)<=500 and reference_url ~* '^https://'));

create or replace function private.capture_seller_verification_request_snapshot()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  seller_row record;
begin
  select s.business_name,s.seller_type,s.business_kind,s.location,s.postcode,s.owner_id
  into seller_row
  from public.sellers s
  where s.id=new.seller_id;

  if seller_row.owner_id is distinct from new.requester_id then
    raise exception 'Verification can only be requested by the seller account owner.';
  end if;
  if seller_row.seller_type<>'business' then
    raise exception 'Business verification is only available to business sellers.';
  end if;
  if seller_row.business_kind is null then
    raise exception 'Choose your automotive business category before requesting verification.';
  end if;

  new.legal_business_name=nullif(left(btrim(coalesce(new.legal_business_name,'')),180),'');
  new.business_reference=nullif(left(btrim(coalesce(new.business_reference,'')),180),'');
  new.reference_url=nullif(left(btrim(coalesce(new.reference_url,'')),500),'');

  if new.legal_business_name is null then
    raise exception 'Legal or registered business name is required.';
  end if;
  if new.business_reference is null and new.reference_url is null then
    raise exception 'Add a business registration/licensing reference or a public business URL.';
  end if;
  if new.reference_url is not null and new.reference_url !~* '^https://' then
    raise exception 'Business reference URL must use HTTPS.';
  end if;

  new.business_name_snapshot:=seller_row.business_name;
  new.seller_type_snapshot:=seller_row.seller_type;
  new.business_kind_snapshot:=seller_row.business_kind;
  new.location_snapshot:=seller_row.location;
  new.postcode_snapshot:=seller_row.postcode;
  return new;
end;
$$;

drop trigger if exists seller_verification_capture_snapshot on public.seller_verification_requests;
create trigger seller_verification_capture_snapshot
before insert on public.seller_verification_requests
for each row
execute function private.capture_seller_verification_request_snapshot();

create or replace function public.admin_review_seller_verification(
  p_request_id uuid,
  p_approve boolean,
  p_review_note text default null
)
returns void
language plpgsql
set search_path=''
as $$
declare
  target record;
begin
  if not private.is_admin() then raise exception 'Administrator access required.'; end if;

  select
    r.id,r.seller_id,r.legal_business_name,r.business_reference,r.reference_url,
    r.business_name_snapshot,r.seller_type_snapshot,r.business_kind_snapshot,
    r.location_snapshot,r.postcode_snapshot,
    s.business_name,s.seller_type,s.business_kind,s.location,s.postcode
  into target
  from public.seller_verification_requests r
  join public.sellers s on s.id=r.seller_id
  where r.id=p_request_id and r.status='pending'
  for update of r,s;

  if target.id is null then raise exception 'Pending verification request not found.'; end if;

  if p_approve then
    if target.legal_business_name is null
       or (target.business_reference is null and target.reference_url is null) then
      raise exception 'Verification evidence is incomplete.';
    end if;

    if target.business_name is distinct from target.business_name_snapshot
       or target.seller_type is distinct from target.seller_type_snapshot
       or target.business_kind is distinct from target.business_kind_snapshot
       or target.location is distinct from target.location_snapshot
       or target.postcode is distinct from target.postcode_snapshot then
      raise exception 'Seller identity changed after the verification request was submitted.';
    end if;
  end if;

  update public.seller_verification_requests
  set status=case when p_approve then 'approved' else 'rejected' end,
      reviewed_at=now(),
      reviewed_by=(select auth.uid()),
      review_note=nullif(left(btrim(coalesce(p_review_note,'')),500),'')
  where id=p_request_id;

  if p_approve then
    update public.sellers
    set verified_at=coalesce(verified_at,now()),updated_at=now()
    where id=target.seller_id;
  end if;
end;
$$;
