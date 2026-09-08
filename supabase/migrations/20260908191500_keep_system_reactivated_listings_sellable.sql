create or replace function public.cancel_checkout_order(
  p_order_id uuid,
  p_event_id text default null,
  p_event_type text default 'checkout_cancelled'
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  current_status text;
  item record;
begin
  if p_event_id is not null then
    insert into public.payment_events(provider,provider_event_id,event_type,order_id)
    values('stripe',p_event_id,p_event_type,p_order_id)
    on conflict(provider_event_id) do nothing;
    if not found then return false; end if;
  end if;

  select payment_status into current_status
  from public.orders
  where id=p_order_id
  for update;

  if current_status is null then return false; end if;
  if current_status in ('paid','partially_refunded','refunded','disputed') then return false; end if;
  if current_status='cancelled' then return true; end if;

  for item in
    select oi.id,oi.part_id,oi.quantity,p.status,p.stock,p.seller_id
    from public.order_items oi
    join public.parts p on p.id=oi.part_id
    where oi.order_id=p_order_id
    for update of p
  loop
    update public.parts
    set
      stock=stock+item.quantity,
      status=case
        when status='reserved'::public.listing_status and public.seller_checkout_ready(item.seller_id)
          then 'active'::public.listing_status
        when status='reserved'::public.listing_status
          then 'draft'::public.listing_status
        else status
      end
    where id=item.part_id;

    update public.order_items
    set fulfilment_status='cancelled',cancelled_at=coalesce(cancelled_at,now())
    where id=item.id and fulfilment_status='pending';
  end loop;

  update public.orders
  set status='cancelled',payment_status='cancelled',cancelled_at=coalesce(cancelled_at,now())
  where id=p_order_id;

  insert into public.order_events(order_id,event_type,from_status,to_status,metadata)
  values(p_order_id,p_event_type,current_status,'cancelled','{}'::jsonb);

  return true;
end;
$$;

revoke all on function public.cancel_checkout_order(uuid,text,text) from public,anon,authenticated;
grant execute on function public.cancel_checkout_order(uuid,text,text) to service_role;

create or replace function public.confirm_checkout_paid(
  p_order_id uuid,
  p_event_id text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_charge_id text,
  p_shipping_name text default null,
  p_shipping_address jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  buyer uuid;
  old_payment text;
  item record;
begin
  insert into public.payment_events(provider,provider_event_id,event_type,order_id,payload_ref)
  values('stripe',p_event_id,'checkout_paid',p_order_id,
    jsonb_build_object('checkout_session',p_checkout_session_id,'payment_intent',p_payment_intent_id,'charge',p_charge_id))
  on conflict(provider_event_id) do nothing;
  if not found then return false; end if;

  select buyer_id,payment_status into buyer,old_payment
  from public.orders
  where id=p_order_id
  for update;

  if buyer is null then raise exception 'Order not found.'; end if;
  if old_payment='cancelled' then raise exception 'Cannot mark a cancelled order paid.'; end if;
  if old_payment in ('paid','partially_refunded','refunded','disputed') then return true; end if;

  update public.orders
  set
    status='paid',
    payment_status='paid',
    provider_checkout_session_id=p_checkout_session_id,
    provider_payment_intent_id=p_payment_intent_id,
    provider_charge_id=p_charge_id,
    shipping_name=nullif(left(btrim(coalesce(p_shipping_name,'')),160),''),
    shipping_address=p_shipping_address,
    paid_at=coalesce(paid_at,now())
  where id=p_order_id;

  update public.order_items
  set fulfilment_status=case when fulfilment_status='pending' then 'preparing' else fulfilment_status end
  where order_id=p_order_id;

  for item in
    select oi.id,oi.part_id,oi.seller_id,s.owner_id,p.stock,p.status,p.title
    from public.order_items oi
    join public.sellers s on s.id=oi.seller_id
    join public.parts p on p.id=oi.part_id
    where oi.order_id=p_order_id
  loop
    update public.parts
    set status=case
      when stock=0 then 'sold'::public.listing_status
      when public.seller_checkout_ready(item.seller_id) then 'active'::public.listing_status
      else 'draft'::public.listing_status
    end
    where id=item.part_id
      and status='reserved'::public.listing_status;

    if item.owner_id is not null then
      insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
      values(item.owner_id,'order_paid','New paid order',left(item.title,240),'/dashboard/orders',
        'order-paid:'||p_order_id::text||':seller:'||item.seller_id::text)
      on conflict do nothing;
    end if;
  end loop;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(buyer,'order_paid','Payment received','Your SecondPart order is now paid.','/account/orders',
    'order-paid:'||p_order_id::text||':buyer')
  on conflict do nothing;

  insert into public.order_events(order_id,event_type,from_status,to_status,metadata)
  values(p_order_id,'payment_confirmed',old_payment,'paid',
    jsonb_build_object('checkout_session',p_checkout_session_id,'payment_intent',p_payment_intent_id));

  return true;
end;
$$;

revoke all on function public.confirm_checkout_paid(uuid,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.confirm_checkout_paid(uuid,text,text,text,text,text,jsonb) to service_role;
