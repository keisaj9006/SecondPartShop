create or replace function private.capture_seller_verification_request_snapshot()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  seller_row record;
begin
  select
    s.business_name,
    s.seller_type,
    s.business_kind,
    s.location,
    s.postcode,
    s.owner_id
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

  new.status:='pending';
  new.requested_at:=now();
  new.reviewed_at:=null;
  new.reviewed_by:=null;
  new.review_note:=null;
  new.business_name_snapshot:=seller_row.business_name;
  new.seller_type_snapshot:=seller_row.seller_type;
  new.business_kind_snapshot:=seller_row.business_kind;
  new.location_snapshot:=seller_row.location;
  new.postcode_snapshot:=seller_row.postcode;

  return new;
end;
$$;
