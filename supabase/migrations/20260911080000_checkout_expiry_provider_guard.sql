-- Prevent database-only expiry from cancelling a Stripe-backed reservation
-- before the payment provider has confirmed that the Checkout Session expired.
-- Provider-backed reservations are released by Stripe webhook/reconciliation.

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
  provider_session text;
  item record;
begin
  select payment_status,provider_checkout_session_id
  into current_status,provider_session
  from public.orders
  where id=p_order_id
  for update;

  if current_status is null then return false; end if;

  -- The database timeout is not authoritative once a Stripe Checkout Session
  -- exists. Only provider-confirmed expiry/failure or reconciliation may
  -- cancel that reservation. This prevents a delayed paid webhook from racing
  -- with the local expiry cron and releasing stock that was actually sold.
  if p_event_type='checkout_reservation_expired' and provider_session is not null then
    return false;
  end if;

  if p_event_id is not null then
    insert into public.payment_events(provider,provider_event_id,event_type,order_id)
    values('stripe',p_event_id,p_event_type,p_order_id)
    on conflict(provider_event_id) do nothing;
    if not found then return false; end if;
  end if;

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

create or replace function private.expire_stale_checkout_orders()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  stale record;
  processed integer := 0;
begin
  for stale in
    select o.id
    from public.orders o
    where o.payment_status in ('unpaid','requires_action','processing')
      and o.checkout_expires_at is not null
      and o.checkout_expires_at<=now()
      -- Once a provider session exists, Stripe is the source of truth for
      -- whether the session is expired or paid. Webhook/reconciliation owns
      -- that transition; the database cron must not guess.
      and o.provider_checkout_session_id is null
    order by o.checkout_expires_at
    limit 500
  loop
    if public.cancel_checkout_order(stale.id,null,'checkout_reservation_expired') then
      processed := processed+1;
    end if;
  end loop;
  return processed;
end;
$$;

revoke all on function private.expire_stale_checkout_orders() from public;
