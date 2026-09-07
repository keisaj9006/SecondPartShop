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
  actor uuid:=(select auth.uid());
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

  if p_action='preparing' then
    if item.fulfilment_status not in ('paid','preparing') then
      raise exception 'This sale can no longer be moved back to preparing.';
    end if;
    next_status:='preparing';
  elsif p_action='dispatch' then
    if item.delivery_method<>'shipping' then raise exception 'Collection orders cannot be dispatched.'; end if;
    if item.fulfilment_status not in ('paid','preparing') then
      raise exception 'This sale is not ready to be dispatched.';
    end if;
    if length(btrim(coalesce(p_tracking_number,'')))<3 then raise exception 'Add a tracking or shipment reference.'; end if;
    next_status:='dispatched';
  elsif p_action='ready_for_collection' then
    if item.delivery_method<>'collection' then raise exception 'This is not a collection order.'; end if;
    if item.fulfilment_status not in ('paid','preparing') then
      raise exception 'This sale is not ready for collection handoff.';
    end if;
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
  values(
    item.order_id,item.id,actor,'seller_fulfilment_update',item.fulfilment_status,next_status,
    jsonb_build_object(
      'carrier',nullif(left(btrim(coalesce(p_carrier,'')),80),''),
      'tracking_number',nullif(left(btrim(coalesce(p_tracking_number,'')),120),'')
    )
  );

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(
    item.buyer_id,
    case when next_status='dispatched' then 'order_dispatched' else 'order_update' end,
    case
      when next_status='dispatched' then 'Your order has been dispatched'
      when next_status='ready_for_collection' then 'Your order is ready for collection'
      else 'Your order is being prepared'
    end,
    case when next_status='ready_for_collection' then 'Your item is ready for collection.' else left(item.title,240) end,
    '/account/orders',
    'fulfilment:'||item.id::text||':'||next_status
  )
  on conflict do nothing;

  perform private.recompute_order_status(item.order_id);
  return true;
end;
$$;
