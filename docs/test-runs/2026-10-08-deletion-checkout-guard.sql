-- SecondPart P0 deletion/checkout race: exact LOCAL proposal, 2026-10-08.
-- NOT an applied migration. Owner approval and hosted definition/ledger preflight
-- are required before any hosted DDL. Do not execute against Production.
-- Replace all five functions atomically; changing only an activity state check
-- leaves the checkout-before-claim interleaving unsafe.
-- Base definitions: 20260906163000 checkout; 20260909233000 deletion claim;
-- 20260907181459 fitting creation and null-safe garage response authority.
-- 20260907183900 retained fitting message authority.
-- Existing buyer fitting response function is unchanged.
-- No table DML, RLS changes, ledger reconciliation, money movement or retention
-- policy changes are part of this proposal.
-- Lock order: sorted account(s) -> request (claim) / listing (checkout).
-- Fitting locks buyer and garage owner and re-reads garage availability.
-- Exact READ COMMITTED PostgreSQL 17 contention remains a disposable DB gate.

begin;

create or replace function public.prepare_checkout_order(
  p_part_id uuid,
  p_quantity integer default 1,
  p_delivery_method text default 'shipping'
)
returns table(
  order_id uuid,
  order_item_id uuid,
  part_title text,
  seller_name text,
  quantity integer,
  unit_price_pence integer,
  shipping_pence integer,
  platform_fee_pence integer,
  seller_net_pence integer,
  total_pence integer,
  checkout_expires_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  buyer uuid := auth.uid();
  part_row record;
  settings_row record;
  subtotal integer;
  shipping integer;
  fee integer;
  seller_net integer;
  new_order uuid;
  new_item uuid;
  expiry timestamptz;
begin
  if buyer is null then
    raise exception 'Authentication required.';
  end if;
  -- Same account lock as deletion claim, before any listing/order locks.
  -- Under the application's READ COMMITTED isolation, the statement after a
  -- waited lock sees the committed claim before creating a new obligation.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('secondpart-account-commerce:'||buyer::text,0)
  );
  if exists(
    select 1 from public.account_deletion_requests r
    where coalesce(r.profile_id,r.target_profile_id)=buyer
      and (
        r.status='processing'
        or (r.attempt_count>0 and r.status in ('failed','blocked'))
      )
  ) then
    raise exception 'Account deletion is in progress. New checkout is unavailable.';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'Choose a valid quantity.';
  end if;
  if p_delivery_method not in ('shipping','collection') then
    raise exception 'Choose shipping or collection.';
  end if;

  select
    p.id,p.title,p.price_pence,p.stock,p.status,p.shipping_pence,
    p.collection_available,p.seller_id,
    s.owner_id,s.business_name
  into part_row
  from public.parts p
  join public.sellers s on s.id=p.seller_id
  where p.id=p_part_id
  for update of p;

  if part_row.id is null then raise exception 'Part not found.'; end if;
  if part_row.owner_id=buyer then raise exception 'You cannot buy your own listing.'; end if;
  if part_row.status::text<>'active' then raise exception 'This listing is not available for checkout.'; end if;
  if part_row.stock<p_quantity then raise exception 'Not enough stock is available.'; end if;
  if p_delivery_method='collection' and not part_row.collection_available then
    raise exception 'Collection is not available for this listing.';
  end if;
  if not public.seller_checkout_ready(part_row.seller_id) then
    raise exception 'This seller is not ready to receive marketplace payouts yet.';
  end if;

  select * into settings_row from public.commerce_settings where singleton=true;
  subtotal := part_row.price_pence*p_quantity;
  shipping := case when p_delivery_method='shipping' then part_row.shipping_pence else 0 end;
  fee := floor((subtotal::numeric*settings_row.platform_fee_bps)/10000)::integer;
  seller_net := subtotal+shipping-fee;
  expiry := now()+(settings_row.checkout_reservation_minutes||' minutes')::interval;

  insert into public.orders(
    buyer_id,status,total_pence,currency,subtotal_pence,shipping_pence,
    platform_fee_pence,payment_status,payment_provider,checkout_expires_at
  )
  values(
    buyer,'pending_payment',subtotal+shipping,'GBP',subtotal,shipping,
    fee,'unpaid','stripe',expiry
  )
  returning id into new_order;

  insert into public.order_items(
    order_id,part_id,seller_id,quantity,unit_price_pence,
    fulfilment_status,delivery_method,shipping_pence,
    platform_fee_pence,seller_net_pence,payout_status
  )
  values(
    new_order,part_row.id,part_row.seller_id,p_quantity,part_row.price_pence,
    'pending',p_delivery_method,shipping,fee,seller_net,'not_ready'
  )
  returning id into new_item;

  update public.parts
  set
    stock=stock-p_quantity,
    status=case when stock-p_quantity=0 then 'reserved'::public.listing_status else status end
  where id=part_row.id;

  insert into public.order_events(order_id,order_item_id,actor_profile_id,event_type,to_status,metadata)
  values(new_order,new_item,buyer,'checkout_reserved','pending_payment',
    jsonb_build_object('quantity',p_quantity,'delivery_method',p_delivery_method,'expires_at',expiry));

  return query
  select new_order,new_item,part_row.title,part_row.business_name,p_quantity,
    part_row.price_pence,shipping,fee,seller_net,subtotal+shipping,expiry;
end;
$$;
revoke all on function public.prepare_checkout_order(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.prepare_checkout_order(uuid,integer,text) to authenticated,service_role;

create or replace function public.claim_account_deletion_request(p_request_id uuid)
returns table(
  claimed boolean,
  profile_id uuid,
  blocker_code text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  request_row record;
  lock_profile uuid;
  blocker text;
  seller_ids uuid[];
  garage_ids uuid[];
begin
  -- Resolve only the durable request's identity; never accept a caller prefix.
  -- Lock the account before request/inventory locks, matching checkout order.
  select coalesce(r.profile_id,r.target_profile_id) into lock_profile
  from public.account_deletion_requests r where r.id=p_request_id;
  if lock_profile is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('secondpart-account-commerce:'||lock_profile::text,0)
    );
  end if;

  select r.id,r.profile_id,r.target_profile_id,r.status
  into request_row
  from public.account_deletion_requests r
  where r.id=p_request_id
  for update;

  if request_row.id is null then
    return query select false,null::uuid,'request_unavailable'::text;
    return;
  end if;

  if coalesce(request_row.profile_id,request_row.target_profile_id) is distinct from lock_profile then
    raise exception 'Deletion request identity changed while acquiring account authority.';
  end if;

  -- A previous attempt may have already removed Auth/profile. The remaining
  -- operation is only to finish the request audit row.
  if request_row.profile_id is null and request_row.target_profile_id is not null then
    return query select false,request_row.target_profile_id,'identity_already_deleted'::text;
    return;
  end if;

  if request_row.profile_id is null then
    return query select false,null::uuid,'request_unavailable'::text;
    return;
  end if;

  if request_row.status not in ('requested','blocked','failed') then
    return query select false,request_row.profile_id,'request_not_claimable'::text;
    return;
  end if;

  -- After account/request serialization, lock seller inventory. A checkout that locked a
  -- listing finishes before this statement; the fresh blocker check below then
  -- sees that order. New checkouts wait until this transaction completes.
  perform p.id
  from public.parts p
  join public.sellers s on s.id=p.seller_id
  where s.owner_id=request_row.profile_id
  for update of p;

  blocker:=private.account_deletion_blocker(request_row.profile_id);
  if blocker is not null then
    update public.account_deletion_requests
    set
      status='blocked',
      blocker_code=blocker,
      processing_started_at=null,
      last_error=null,
      updated_at=now()
    where id=request_row.id;

    return query select false,request_row.profile_id,blocker;
    return;
  end if;

  select coalesce(array_agg(s.id order by s.id),'{}'::uuid[])
  into seller_ids
  from public.sellers s
  where s.owner_id=request_row.profile_id;

  select coalesce(array_agg(g.id order by g.id),'{}'::uuid[])
  into garage_ids
  from public.garage_partners g
  where g.owner_id=request_row.profile_id;

  -- Freeze public commerce before external storage/Auth work begins.
  update public.parts p
  set status='archived'::public.listing_status
  where p.seller_id=any(seller_ids);

  update public.garage_partners g
  set status='suspended',verified_at=null
  where g.id=any(garage_ids);

  update public.account_deletion_requests
  set
    status='processing',
    blocker_code=null,
    attempt_count=attempt_count+1,
    processing_started_at=now(),
    last_error=null,
    target_profile_id=request_row.profile_id,
    cleanup_seller_ids=seller_ids,
    cleanup_garage_partner_ids=garage_ids,
    updated_at=now()
  where id=request_row.id;

  return query select true,request_row.profile_id,null::text;
end;
$$;
revoke all on function public.claim_account_deletion_request(uuid) from public,anon,authenticated,service_role;
grant execute on function public.claim_account_deletion_request(uuid) to service_role;

create or replace function public.request_part_fitting_quote(
  p_part_id uuid,
  p_garage_partner_id uuid,
  p_vehicle_variant_id uuid,
  p_vehicle_year smallint,
  p_vehicle_fuel text default null,
  p_vehicle_engine integer default null,
  p_vehicle_registration text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
  part_row record;
  garage_row record;
  new_id uuid;
  normalized_registration text;
  lock_account uuid;
  expected_garage_owner uuid;
begin
  if actor is null then raise exception 'Authentication required.'; end if;

  select p.id,p.seller_id,s.owner_id as seller_owner
  into part_row
  from public.parts p
  join public.sellers s on s.id=p.seller_id
  where p.id=p_part_id and p.status='active'::public.listing_status;

  if part_row.id is null then raise exception 'Listing is not available for fitting requests.'; end if;
  if part_row.seller_owner=actor then raise exception 'You cannot request fitting for your own listing.'; end if;

  select g.id,g.owner_id,g.customer_supplied_parts,g.recycled_parts
  into garage_row
  from public.garage_partners g
  where g.id=p_garage_partner_id and g.status='active';

  if garage_row.id is null then raise exception 'Garage partner is not available.'; end if;
  if garage_row.owner_id=actor then raise exception 'You cannot request a quote from your own garage profile.'; end if;
  -- Fitting is an obligation for both buyer and garage owner. Resolve from
  -- trusted rows, then lock their accounts in UUID order before any row locks.
  -- A reciprocal request uses the same order and cannot invert the locks.
  expected_garage_owner:=garage_row.owner_id;
  for lock_account in
    select distinct locked.account_id
    from unnest(array[actor,expected_garage_owner]) as locked(account_id)
    where locked.account_id is not null
    order by locked.account_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('secondpart-account-commerce:'||lock_account::text,0)
    );
  end loop;

  if exists(
    select 1 from public.account_deletion_requests r
    where coalesce(r.profile_id,r.target_profile_id)=any(array[actor,expected_garage_owner])
      and (
        r.status='processing'
        or (r.attempt_count>0 and r.status in ('failed','blocked'))
      )
  ) then
    raise exception 'Account deletion is in progress. New fitting requests are unavailable.';
  end if;

  -- A deletion claim or owner/status change may have committed while waiting.
  -- Never use the pre-lock garage availability or a different owner's lock.
  select g.id,g.owner_id,g.customer_supplied_parts,g.recycled_parts
  into garage_row
  from public.garage_partners g
  where g.id=p_garage_partner_id and g.status='active'
    and g.owner_id=expected_garage_owner;
  if garage_row.id is null then raise exception 'Garage partner is not available.'; end if;

  if not garage_row.customer_supplied_parts or not garage_row.recycled_parts then
    raise exception 'This garage is not accepting customer-supplied recycled parts.';
  end if;

  if not exists(
    select 1 from public.vehicle_catalogue_years y
    where y.variant_id=p_vehicle_variant_id and y.year_first_used=p_vehicle_year
  ) then
    raise exception 'The selected vehicle/year is not in the vehicle catalogue.';
  end if;

  if p_vehicle_fuel is not null or p_vehicle_engine is not null then
    if not exists(
      select 1 from public.vehicle_catalogue_engines e
      where e.variant_id=p_vehicle_variant_id
        and (p_vehicle_fuel is null or upper(e.fuel_type)=upper(p_vehicle_fuel))
        and (p_vehicle_engine is null or e.engine_size_simple=p_vehicle_engine)
    ) then
      raise exception 'The selected engine/fuel combination is not in the vehicle catalogue.';
    end if;
  end if;

  normalized_registration:=nullif(regexp_replace(upper(coalesce(p_vehicle_registration,'')),'[^A-Z0-9]','','g'),'');
  if normalized_registration is not null and normalized_registration !~ '^[A-Z0-9]{2,8}$' then
    raise exception 'The vehicle registration is not valid.';
  end if;

  if (select count(*) from public.fitting_requests r where r.buyer_id=actor and r.status in ('requested','quoted','accepted'))>=20 then
    raise exception 'Too many active fitting requests.';
  end if;

  if exists(
    select 1 from public.fitting_requests r
    where r.buyer_id=actor
      and r.part_id=p_part_id
      and r.garage_partner_id=p_garage_partner_id
      and r.vehicle_variant_id=p_vehicle_variant_id
      and r.vehicle_year=p_vehicle_year
      and r.status in ('requested','quoted','accepted')
  ) then
    raise exception 'A fitting request is already open for this part, garage and vehicle.';
  end if;

  insert into public.fitting_requests(
    buyer_id,part_id,garage_partner_id,vehicle_variant_id,vehicle_year,
    vehicle_fuel,vehicle_engine_size,vehicle_registration,buyer_notes
  )
  values(
    actor,p_part_id,p_garage_partner_id,p_vehicle_variant_id,p_vehicle_year,
    nullif(left(btrim(coalesce(p_vehicle_fuel,'')),80),''),
    p_vehicle_engine,
    normalized_registration,
    nullif(left(btrim(coalesce(p_notes,'')),1000),'')
  )
  returning id into new_id;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(
    garage_row.owner_id,
    'fitting_request',
    'New fitting quote request',
    'A buyer requested a labour quote for a SecondPart part.',
    '/garage-partner/requests',
    'fitting-request:'||new_id::text||':garage'
  )
  on conflict do nothing;

  return new_id;
end;
$$;
-- Exact hosted ACL retained: both bound authenticated and service calls.
revoke all on function public.request_part_fitting_quote(uuid,uuid,uuid,smallint,text,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function public.request_part_fitting_quote(uuid,uuid,uuid,smallint,text,integer,text,text) to authenticated,service_role;

create or replace function public.garage_respond_fitting_request(
  p_request_id uuid,
  p_action text,
  p_quote_pence integer default null,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
  request_row record;
begin
  if actor is null then raise exception 'Authentication required.'; end if;

  select r.id,r.status,r.buyer_id,g.owner_id
  into request_row
  from public.fitting_requests r
  join public.garage_partners g on g.id=r.garage_partner_id
  where r.id=p_request_id
  for update of r;

  if request_row.id is null or (request_row.owner_id is distinct from actor and not private.is_admin()) then
    raise exception 'Fitting request not found.';
  end if;

  if p_action='quote' then
    if request_row.status not in ('requested','quoted') then raise exception 'This fitting request cannot be quoted.'; end if;
    if p_quote_pence is null or p_quote_pence<0 or p_quote_pence>2000000 then raise exception 'Enter a valid labour quote.'; end if;

    update public.fitting_requests
    set status='quoted',
        quote_pence=p_quote_pence,
        quote_note=nullif(left(btrim(coalesce(p_note,'')),1000),''),
        quoted_at=now()
    where id=p_request_id;

    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      request_row.buyer_id,'fitting_quote','Garage sent a fitting quote',
      'A garage responded to your SecondPart fitting request.',
      '/account/fitting','fitting-quote:'||p_request_id::text||':buyer'
    ) on conflict do nothing;
    return true;
  elsif p_action='decline' then
    if request_row.status not in ('requested','quoted') then raise exception 'This fitting request cannot be declined.'; end if;
    update public.fitting_requests
    set status='declined',
        quote_note=nullif(left(btrim(coalesce(p_note,'')),1000),'')
    where id=p_request_id;

    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      request_row.buyer_id,'fitting_quote','Garage declined the fitting request',
      'Try another SecondPart garage partner for this part.',
      '/account/fitting','fitting-declined:'||p_request_id::text||':buyer'
    ) on conflict do nothing;
    return true;
  elsif p_action='complete' then
    if request_row.status<>'accepted' then raise exception 'Only an accepted fitting request can be completed.'; end if;
    update public.fitting_requests set status='completed',completed_at=now() where id=p_request_id;
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      request_row.buyer_id,'fitting_update','Garage marked fitting complete',
      'Your fitting request was marked completed.',
      '/account/fitting','fitting-complete:'||p_request_id::text||':buyer'
    ) on conflict do nothing;
    return true;
  end if;

  raise exception 'Invalid fitting request action.';
end;
$$;
-- RC26-08: nullable retained garage owners must deny unrelated callers.
-- Existing hosted authenticated/service-role grants are retained.
revoke all on function public.garage_respond_fitting_request(uuid,text,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.garage_respond_fitting_request(uuid,text,integer,text) to authenticated,service_role;

create or replace function public.send_fitting_request_message(
  p_request_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
  request_row record;
  new_id uuid;
  recipient uuid;
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if char_length(btrim(coalesce(p_body,'')))<1 then raise exception 'Message is required.'; end if;

  select r.id,r.status,r.buyer_id,g.owner_id
  into request_row
  from public.fitting_requests r
  join public.garage_partners g on g.id=r.garage_partner_id
  where r.id=p_request_id;

  if request_row.id is null then raise exception 'Fitting request not found.'; end if;
  if actor is distinct from request_row.buyer_id
     and actor is distinct from request_row.owner_id
     and not private.is_admin() then
    raise exception 'Fitting request not found.';
  end if;
  if request_row.status<>'accepted' then
    raise exception 'Messages are available after the fitting quote is accepted.';
  end if;

  insert into public.fitting_request_messages(fitting_request_id,sender_profile_id,body)
  values(p_request_id,actor,left(btrim(p_body),2000))
  returning id into new_id;

  recipient:=case when actor=request_row.buyer_id then request_row.owner_id else request_row.buyer_id end;
  if recipient is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      recipient,
      'fitting_message',
      'New Buy + Fit message',
      left(btrim(p_body),160),
      case when recipient=request_row.buyer_id then '/account/fitting' else '/garage-partner/requests' end,
      'fitting-message:'||new_id::text||':'||recipient::text
    )
    on conflict do nothing;
  end if;

  return new_id;
end;
$$;
-- RC26-08: both retained participant identities must fail closed.
-- Exact hosted authenticated/service-role grants are retained.
revoke all on function public.send_fitting_request_message(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.send_fitting_request_message(uuid,text) to authenticated,service_role;

commit;
