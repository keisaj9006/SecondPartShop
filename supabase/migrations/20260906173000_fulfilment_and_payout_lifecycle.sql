-- Authenticated fulfilment controls and service-only payout finalisation.

create or replace function private.recompute_order_status(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  total_items integer;
  completed_items integer;
  refunded_items integer;
  active_items integer;
begin
  select
    count(*),
    count(*) filter (where fulfilment_status='completed'),
    count(*) filter (where fulfilment_status='refunded'),
    count(*) filter (where fulfilment_status not in ('completed','refunded','cancelled'))
  into total_items,completed_items,refunded_items,active_items
  from public.order_items
  where order_id=p_order_id;

  if total_items=0 then return; end if;

  update public.orders
  set status=case
    when completed_items=total_items then 'completed'
    when refunded_items=total_items then 'refunded'
    when refunded_items>0 then 'partially_refunded'
    when completed_items>0 and active_items>0 then 'partially_fulfilled'
    when payment_status='paid' then 'processing'
    else status
  end
  where id=p_order_id;
end;
$$;

revoke all on function private.recompute_order_status(uuid) from public;

create or replace function public.seller_set_order_item_fulfilment(
  p_order_item_id uuid,
  p_action text,
  p_carrier text default null,
  p_tracking_number text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  item record;
  next_status text;
begin
  if actor is null then raise exception 'Authentication required.'; end if;

  select
    oi.id,oi.order_id,oi.delivery_method,oi.fulfilment_status,
    s.owner_id,o.payment_status,o.buyer_id,p.title
  into item
  from public.order_items oi
  join public.sellers s on s.id=oi.seller_id
  join public.orders o on o.id=oi.order_id
  join public.parts p on p.id=oi.part_id
  where oi.id=p_order_item_id
  for update of oi;

  if item.id is null or (item.owner_id<>actor and not private.is_admin()) then
    raise exception 'Sale not found.';
  end if;
  if item.payment_status<>'paid' then raise exception 'The order has not been paid.'; end if;
  if item.fulfilment_status in ('cancelled','refunded','return_requested','return_approved','returned','dispute_open') then
    raise exception 'This order item cannot be updated while a case is active.';
  end if;

  if p_action='preparing' then
    next_status:='preparing';
  elsif p_action='dispatch' then
    if item.delivery_method<>'shipping' then raise exception 'Collection orders cannot be dispatched.'; end if;
    if length(btrim(coalesce(p_tracking_number,'')))<3 then raise exception 'Add a tracking or shipment reference.'; end if;
    next_status:='dispatched';
  elsif p_action='ready_for_collection' then
    if item.delivery_method<>'collection' then raise exception 'This is not a collection order.'; end if;
    next_status:='ready_for_collection';
  else
    raise exception 'Invalid fulfilment action.';
  end if;

  update public.order_items
  set
    fulfilment_status=next_status,
    tracking_carrier=case when next_status='dispatched' then nullif(left(btrim(coalesce(p_carrier,'')),80),'') else tracking_carrier end,
    tracking_number=case when next_status='dispatched' then left(btrim(p_tracking_number),120) else tracking_number end,
    dispatched_at=case when next_status='dispatched' then coalesce(dispatched_at,now()) else dispatched_at end
  where id=p_order_item_id;

  insert into public.order_events(order_id,order_item_id,actor_profile_id,event_type,from_status,to_status,metadata)
  values(item.order_id,item.id,actor,'seller_fulfilment_update',item.fulfilment_status,next_status,
    jsonb_build_object('carrier',nullif(left(btrim(coalesce(p_carrier,'')),80),''),'tracking_number',nullif(left(btrim(coalesce(p_tracking_number,'')),120),'')));

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(
    item.buyer_id,
    case when next_status='dispatched' then 'order_dispatched' else 'order_update' end,
    case when next_status='dispatched' then 'Your order has been dispatched' else 'Your order is being prepared' end,
    case when next_status='ready_for_collection' then 'Your item is ready for collection.' else left(item.title,240) end,
    '/account/orders',
    'fulfilment:'||item.id::text||':'||next_status
  )
  on conflict do nothing;

  perform private.recompute_order_status(item.order_id);
  return true;
end;
$$;

revoke all on function public.seller_set_order_item_fulfilment(uuid,text,text,text) from public;
grant execute on function public.seller_set_order_item_fulfilment(uuid,text,text,text) to authenticated;

create or replace function public.buyer_mark_order_item_received(
  p_order_item_id uuid,
  p_accept_now boolean default false
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  item record;
  settings_row record;
  next_status text;
  eligibility timestamptz;
begin
  if actor is null then raise exception 'Authentication required.'; end if;

  select oi.id,oi.order_id,oi.fulfilment_status,oi.payout_status,o.buyer_id,o.payment_status,p.title,s.owner_id
  into item
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.parts p on p.id=oi.part_id
  join public.sellers s on s.id=oi.seller_id
  where oi.id=p_order_item_id
  for update of oi;

  if item.id is null or item.buyer_id<>actor then raise exception 'Purchase not found.'; end if;
  if item.payment_status<>'paid' then raise exception 'The order has not been paid.'; end if;
  if item.fulfilment_status not in ('dispatched','ready_for_collection','delivered','accepted') then
    raise exception 'This item is not ready for receipt confirmation.';
  end if;
  if item.fulfilment_status in ('accepted') and item.payout_status in ('scheduled','released') then return true; end if;

  select * into settings_row from public.commerce_settings where singleton=true;
  next_status:=case when p_accept_now then 'accepted' else 'delivered' end;
  eligibility:=case when p_accept_now then now() else now()+(settings_row.auto_release_hours||' hours')::interval end;

  update public.order_items
  set
    fulfilment_status=next_status,
    buyer_received_at=coalesce(buyer_received_at,now()),
    delivered_at=coalesce(delivered_at,now()),
    accepted_at=case when p_accept_now then coalesce(accepted_at,now()) else accepted_at end,
    release_eligible_at=eligibility,
    payout_status=case when payout_status='released' then payout_status else 'scheduled' end
  where id=item.id;

  insert into public.order_events(order_id,order_item_id,actor_profile_id,event_type,from_status,to_status,metadata)
  values(item.order_id,item.id,actor,
    case when p_accept_now then 'buyer_accepted' else 'buyer_received' end,
    item.fulfilment_status,next_status,
    jsonb_build_object('release_eligible_at',eligibility));

  if item.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      item.owner_id,
      case when p_accept_now then 'order_accepted' else 'order_received' end,
      case when p_accept_now then 'Buyer accepted the item' else 'Buyer confirmed delivery' end,
      left(item.title,240),
      '/dashboard/orders',
      'buyer-received:'||item.id::text||':'||next_status
    )
    on conflict do nothing;
  end if;

  perform private.recompute_order_status(item.order_id);
  return true;
end;
$$;

revoke all on function public.buyer_mark_order_item_received(uuid,boolean) from public;
grant execute on function public.buyer_mark_order_item_received(uuid,boolean) to authenticated;

create or replace function public.mark_order_item_payout_released(
  p_order_item_id uuid,
  p_transfer_id text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  item record;
begin
  select oi.id,oi.order_id,oi.payout_status,oi.release_eligible_at,o.buyer_id,p.title
  into item
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.parts p on p.id=oi.part_id
  where oi.id=p_order_item_id
  for update of oi;

  if item.id is null then return false; end if;
  if item.payout_status='released' then return true; end if;
  if item.release_eligible_at is null or item.release_eligible_at>now() then
    raise exception 'Payout is not eligible for release.';
  end if;

  update public.order_items
  set
    payout_status='released',
    provider_transfer_id=p_transfer_id,
    funds_released_at=coalesce(funds_released_at,now()),
    fulfilment_status='completed'
  where id=item.id;

  insert into public.order_events(order_id,order_item_id,event_type,from_status,to_status,metadata)
  values(item.order_id,item.id,'seller_transfer_released',item.payout_status,'released',
    jsonb_build_object('transfer_id',p_transfer_id));

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(item.buyer_id,'order_update','Transaction completed',left(item.title,240),'/account/orders',
    'transaction-complete:'||item.id::text)
  on conflict do nothing;

  perform private.recompute_order_status(item.order_id);
  return true;
end;
$$;

revoke all on function public.mark_order_item_payout_released(uuid,text) from public;
grant execute on function public.mark_order_item_payout_released(uuid,text) to service_role;

create or replace function public.get_due_payout_order_items(p_limit integer default 100)
returns table(order_item_id uuid)
language sql
security definer
set search_path=''
as $$
  select oi.id
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  where oi.payout_status='scheduled'
    and oi.release_eligible_at is not null
    and oi.release_eligible_at<=now()
    and oi.funds_released_at is null
    and o.payment_status='paid'
  order by oi.release_eligible_at
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

revoke all on function public.get_due_payout_order_items(integer) from public;
grant execute on function public.get_due_payout_order_items(integer) to service_role;
