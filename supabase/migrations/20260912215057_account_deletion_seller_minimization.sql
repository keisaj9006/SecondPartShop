-- Minimise identifying seller-linked data retained after account deletion.
-- Commerce, provider, inventory and technical donor records remain in place;
-- only fields without an ongoing audit/technical purpose are scrubbed here.

create or replace function public.prepare_claimed_account_deletion(
  p_request_id uuid,
  p_profile_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  request_row record;
  blocker text;
begin
  select
    r.id,
    r.profile_id,
    r.target_profile_id,
    r.status,
    r.cleanup_seller_ids,
    r.cleanup_garage_partner_ids
  into request_row
  from public.account_deletion_requests r
  where r.id=p_request_id
  for update;

  if request_row.id is null
     or request_row.profile_id is distinct from p_profile_id
     or request_row.target_profile_id is distinct from p_profile_id
     or request_row.status<>'processing' then
    raise exception 'Deletion request is not claimed for this profile.';
  end if;

  blocker:=private.account_deletion_blocker(p_profile_id);
  if blocker is not null then
    update public.account_deletion_requests
    set
      status='blocked',
      blocker_code=blocker,
      processing_started_at=null,
      updated_at=now()
    where id=p_request_id;
    return false;
  end if;

  -- Pre-purchase content and public reputation are not required transaction records.
  delete from public.listing_conversations c
  where c.buyer_id=p_profile_id
     or c.seller_id=any(request_row.cleanup_seller_ids);

  delete from public.transaction_reviews
  where reviewer_id=p_profile_id or reviewee_id=p_profile_id;

  -- A terminal order still retains money/provider/audit facts, but the shipping
  -- destination is no longer needed once there is no active fulfilment/case blocker.
  update public.orders
  set
    shipping_name=null,
    shipping_address=null
  where buyer_id=p_profile_id;

  -- Closed Buy + Fit history may remain for operational/accounting context, but
  -- remove the buyer's registration and free-text notes before identity deletion.
  update public.fitting_requests
  set
    vehicle_registration=null,
    buyer_notes=null
  where buyer_id=p_profile_id;

  -- Storage objects are removed by the worker before this DB cleanup.
  delete from public.part_images i
  where exists(
    select 1 from public.parts p
    where p.id=i.part_id
      and p.seller_id=any(request_row.cleanup_seller_ids)
  );

  delete from public.seller_payment_accounts
  where seller_id=any(request_row.cleanup_seller_ids);

  -- Donor make/model/specification and their row identity remain as technical
  -- provenance for retained listings. Registration and notes do not.
  update public.donor_vehicles
  set
    registration=null,
    notes=null
  where seller_id=any(request_row.cleanup_seller_ids);

  -- Import counts/status and row identity remain operational evidence. Client
  -- filenames and per-row error detail can contain names, registrations or paths.
  update public.seller_inventory_imports
  set
    filename=null,
    error_summary='[]'::jsonb
  where seller_id=any(request_row.cleanup_seller_ids);

  -- Seller rows can be referenced by retained order items. Hide the profile from
  -- public marketplace use, remove location, and replace public identifiers with
  -- stable row-based tombstones. Registered business names remain pending the
  -- documented legal-retention decision; private seller display names do not.
  update public.sellers
  set
    business_name=case
      when seller_type='private' then 'Deleted seller'
      else business_name
    end,
    slug='deleted-seller-'||replace(id::text,'-',''),
    location='Deleted',
    verified_at=null,
    postcode=null,
    latitude=null,
    longitude=null,
    postcode_geocoded_at=null,
    postcode_geocode_approximate=false,
    description='',
    account_deleted_at=now()
  where id=any(request_row.cleanup_seller_ids);

  update public.garage_partners
  set
    slug='deleted-garage-'||replace(id::text,'-',''),
    status='suspended',
    verified_at=null,
    postcode='Deleted',
    location='Deleted',
    latitude=null,
    longitude=null,
    description='Account deleted. This garage profile is no longer active.'
  where id=any(request_row.cleanup_garage_partner_ids);

  return true;
end;
$$;

revoke all on function public.prepare_claimed_account_deletion(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.prepare_claimed_account_deletion(uuid,uuid) to service_role;
