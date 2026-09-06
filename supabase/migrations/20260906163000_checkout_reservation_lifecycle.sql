-- Checkout reservation + commerce lifecycle foundation.

alter table public.parts
  add column if not exists shipping_pence integer not null default 0;

alter table public.parts
  drop constraint if exists parts_shipping_pence_check;
alter table public.parts
  add constraint parts_shipping_pence_check
  check (shipping_pence >= 0 and shipping_pence <= 1000000);

alter table public.orders
  add column if not exists checkout_expires_at timestamptz,
  add column if not exists provider_charge_id text,
  add column if not exists refunded_pence integer not null default 0;

alter table public.orders
  drop constraint if exists orders_refunded_nonnegative;
alter table public.orders
  add constraint orders_refunded_nonnegative
  check (refunded_pence >= 0 and refunded_pence <= total_pence);

create index if not exists orders_checkout_expiry_idx
  on public.orders(checkout_expires_at)
  where payment_status in ('unpaid','requires_action','processing');

create index if not exists orders_provider_charge_idx
  on public.orders(provider_charge_id)
  where provider_charge_id is not null;

alter table public.order_items
  add column if not exists buyer_received_at timestamptz;

alter table public.order_items
  drop constraint if exists order_items_fulfilment_status_check;
alter table public.order_items
  add constraint order_items_fulfilment_status_check
  check (fulfilment_status in (
    'pending','paid','preparing','ready_for_collection',
    'dispatched','delivered','accepted','completed',
    'cancelled','return_requested','return_approved',
    'returned','refunded','dispute_open','dispute_resolved'
  ));

create table if not exists public.commerce_settings (
  singleton boolean primary key default true check (singleton),
  platform_fee_bps integer not null default 0 check (platform_fee_bps between 0 and 5000),
  checkout_reservation_minutes integer not null default 30 check (checkout_reservation_minutes between 10 and 1440),
  auto_release_hours integer not null default 48 check (auto_release_hours between 1 and 336),
  updated_at timestamptz not null default now()
);

insert into public.commerce_settings(singleton)
values(true)
on conflict(singleton) do nothing;

alter table public.commerce_settings enable row level security;
revoke all on public.commerce_settings from anon,authenticated;

drop trigger if exists commerce_settings_touch on public.commerce_settings;
create trigger commerce_settings_touch
before update on public.commerce_settings
for each row execute function private.touch_updated_at();

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe')),
  provider_event_id text not null unique,
  event_type text not null,
  order_id uuid references public.orders(id) on delete set null,
  payload_ref jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists payment_events_order_idx
  on public.payment_events(order_id,processed_at desc)
  where order_id is not null;

alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon,authenticated;

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'seller_part_request','buyer_part_match','saved_search_match','account',
    'order_paid','order_update','order_dispatched','order_received',
    'order_accepted','payout_released','return_update','dispute_update'
  ));

-- Safe public readiness signal; no provider account identifiers are exposed.
create or replace function public.seller_checkout_ready(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.seller_payment_accounts spa
    where spa.seller_id=p_seller_id
      and spa.onboarding_status='complete'
      and spa.transfers_enabled
  );
$$;

revoke all on function public.seller_checkout_ready(uuid) from public;
grant execute on function public.seller_checkout_ready(uuid) to anon,authenticated;

-- Reserve stock and snapshot money atomically.
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

revoke all on function public.prepare_checkout_order(uuid,integer,text) from public;
grant execute on function public.prepare_checkout_order(uuid,integer,text) to authenticated;

-- Service-only cancellation/expiry. Idempotently restores reserved stock.
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
    select oi.id,oi.part_id,oi.quantity,p.status,p.stock
    from public.order_items oi
    join public.parts p on p.id=oi.part_id
    where oi.order_id=p_order_id
    for update of p
  loop
    update public.parts
    set
      stock=stock+item.quantity,
      status=case when status='reserved'::public.listing_status then 'active'::public.listing_status else status end
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

revoke all on function public.cancel_checkout_order(uuid,text,text) from public;
grant execute on function public.cancel_checkout_order(uuid,text,text) to service_role;

-- Service-only payment confirmation. Idempotent by Stripe event id.
create or replace function public.confirm_checkout_paid(
  p_order_id uuid,
  p_event_id text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_charge_id text
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

  update public.orders
  set
    status='paid',
    payment_status='paid',
    provider_checkout_session_id=p_checkout_session_id,
    provider_payment_intent_id=p_payment_intent_id,
    provider_charge_id=p_charge_id,
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
    set status=case when stock=0 then 'sold'::public.listing_status else 'active'::public.listing_status end
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

revoke all on function public.confirm_checkout_paid(uuid,text,text,text,text) from public;
grant execute on function public.confirm_checkout_paid(uuid,text,text,text,text) to service_role;

create or replace function public.get_expired_unpaid_orders(p_limit integer default 100)
returns table(order_id uuid)
language sql
security definer
set search_path=''
as $$
  select o.id
  from public.orders o
  where o.payment_status in ('unpaid','requires_action','processing')
    and o.checkout_expires_at is not null
    and o.checkout_expires_at<=now()
  order by o.checkout_expires_at
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

revoke all on function public.get_expired_unpaid_orders(integer) from public;
grant execute on function public.get_expired_unpaid_orders(integer) to service_role;
