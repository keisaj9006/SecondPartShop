-- Silent-buyer payout fallback.
-- No seller transfer is released only because the buyer is inactive.
-- After an unverified shipping delivery has been outstanding for the configured
-- review period, an administrator may start the normal Buyer Protection release
-- window. Any buyer case opened before release still blocks the payout.

alter table public.commerce_settings
  add column if not exists unverified_delivery_review_days integer not null default 14;

alter table public.commerce_settings
  drop constraint if exists commerce_settings_unverified_delivery_review_days_check;
alter table public.commerce_settings
  add constraint commerce_settings_unverified_delivery_review_days_check
  check (unverified_delivery_review_days between 7 and 30);

create index if not exists order_items_unverified_delivery_review_idx
  on public.order_items(dispatched_at)
  where delivery_method='shipping'
    and fulfilment_status='dispatched'
    and payout_status='not_ready'
    and buyer_received_at is null
    and funds_released_at is null;

create or replace function public.get_unverified_delivery_payout_reviews(p_limit integer default 50)
returns table(
  order_item_id uuid,
  order_id uuid,
  part_title text,
  part_slug text,
  seller_name text,
  tracking_carrier text,
  tracking_number text,
  dispatched_at timestamptz,
  age_days integer,
  seller_net_pence integer
)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
begin
  if actor is null or not private.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  return query
  select
    oi.id,
    oi.order_id,
    p.title,
    p.slug,
    s.business_name,
    oi.tracking_carrier,
    oi.tracking_number,
    oi.dispatched_at,
    floor(extract(epoch from (now()-oi.dispatched_at))/86400)::integer,
    oi.seller_net_pence
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.parts p on p.id=oi.part_id
  join public.sellers s on s.id=oi.seller_id
  cross join public.commerce_settings cs
  where cs.singleton=true
    and o.payment_status='paid'
    and oi.delivery_method='shipping'
    and oi.fulfilment_status='dispatched'
    and oi.payout_status='not_ready'
    and oi.buyer_received_at is null
    and oi.funds_released_at is null
    and oi.dispatched_at is not null
    and oi.tracking_number is not null
    and length(btrim(oi.tracking_number))>=3
    and oi.dispatched_at<=now()-(cs.unverified_delivery_review_days||' days')::interval
    and not exists(
      select 1
      from public.transaction_cases c
      where c.order_item_id=oi.id
        and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
    )
  order by oi.dispatched_at asc
  limit greatest(1,least(coalesce(p_limit,50),200));
end;
$$;

revoke all on function public.get_unverified_delivery_payout_reviews(integer) from public;
grant execute on function public.get_unverified_delivery_payout_reviews(integer) to authenticated;

create or replace function public.admin_start_unverified_delivery_release_window(p_order_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
  item record;
  settings_row record;
  eligibility timestamptz;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  select
    oi.id,oi.order_id,oi.delivery_method,oi.fulfilment_status,oi.payout_status,
    oi.buyer_received_at,oi.funds_released_at,oi.dispatched_at,oi.tracking_number,
    o.payment_status,o.buyer_id,p.title,s.owner_id
  into item
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.parts p on p.id=oi.part_id
  join public.sellers s on s.id=oi.seller_id
  where oi.id=p_order_item_id
  for update of oi;

  if item.id is null then raise exception 'Order item not found.'; end if;
  if item.payment_status<>'paid' then raise exception 'Order payment is not eligible for payout.'; end if;
  if item.delivery_method<>'shipping' then raise exception 'Only shipped orders use this fallback.'; end if;
  if item.fulfilment_status<>'dispatched' then raise exception 'This shipment is not awaiting delivery confirmation.'; end if;
  if item.payout_status<>'not_ready' then raise exception 'This payout is already scheduled, blocked or completed.'; end if;
  if item.buyer_received_at is not null then raise exception 'The buyer has already confirmed receipt.'; end if;
  if item.funds_released_at is not null then raise exception 'Seller funds have already been released.'; end if;
  if item.dispatched_at is null then raise exception 'Dispatch time is missing.'; end if;
  if length(btrim(coalesce(item.tracking_number,'')))<3 then raise exception 'A shipment reference is required.'; end if;

  if exists(
    select 1
    from public.transaction_cases c
    where c.order_item_id=item.id
      and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
  ) then
    raise exception 'An active transaction case blocks payout review.';
  end if;

  select * into settings_row
  from public.commerce_settings
  where singleton=true;

  if item.dispatched_at>now()-(settings_row.unverified_delivery_review_days||' days')::interval then
    raise exception 'The unverified-delivery review period has not elapsed.';
  end if;

  eligibility:=now()+(settings_row.auto_release_hours||' hours')::interval;

  update public.order_items
  set
    payout_status='scheduled',
    release_eligible_at=eligibility
  where id=item.id;

  insert into public.order_events(
    order_id,order_item_id,actor_profile_id,event_type,from_status,to_status,metadata
  )
  values(
    item.order_id,item.id,actor,'unverified_delivery_release_window_started',
    'not_ready','scheduled',
    jsonb_build_object(
      'release_eligible_at',eligibility,
      'unverified_delivery_review_days',settings_row.unverified_delivery_review_days,
      'buyer_protection_hours',settings_row.auto_release_hours
    )
  );

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(
    item.buyer_id,
    'order_update',
    'Final delivery check',
    'The seller payout review was approved. Report a problem before the Buyer Protection window ends if the item has not arrived or is not as described.',
    '/account/orders/'||item.order_id::text,
    'unverified-delivery-final-window:'||item.id::text||':buyer'
  )
  on conflict do nothing;

  if item.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      item.owner_id,
      'order_update',
      'Payout review approved',
      'The final Buyer Protection window is running. Funds will remain blocked if the buyer opens a valid case.',
      '/dashboard/orders/'||item.id::text,
      'unverified-delivery-final-window:'||item.id::text||':seller'
    )
    on conflict do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.admin_start_unverified_delivery_release_window(uuid) from public;
grant execute on function public.admin_start_unverified_delivery_release_window(uuid) to authenticated;
