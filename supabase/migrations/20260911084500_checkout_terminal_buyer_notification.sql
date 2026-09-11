-- Keep terminal Stripe Checkout cancellation and buyer notification atomic.
-- Retryable PaymentIntent failures are intentionally excluded because the same
-- hosted Checkout Session may still accept another payment attempt.

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
  order_buyer_id uuid;
  item record;
begin
  select payment_status,provider_checkout_session_id,buyer_id
  into current_status,provider_session,order_buyer_id
  from public.orders
  where id=p_order_id
  for update;

  if current_status is null then return false; end if;

  -- Database time alone is not authoritative once Stripe owns the Checkout
  -- Session. Webhook/reconciliation must confirm terminal provider state.
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

  if order_buyer_id is not null and p_event_type='checkout.session.async_payment_failed' then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      order_buyer_id,
      'account',
      'Payment could not be completed',
      'Your payment did not complete, so the reservation was released. You can return to your purchases and try again.',
      '/account/orders/'||p_order_id::text,
      'checkout-terminal:'||p_order_id::text||':async-payment-failed'
    )
    on conflict do nothing;
  elsif order_buyer_id is not null and p_event_type in ('checkout.session.expired','reconciliation_checkout_expired') then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      order_buyer_id,
      'account',
      'Checkout expired',
      'This checkout expired before payment was confirmed, so the reservation was released. You can start a new checkout if the part is still available.',
      '/account/orders/'||p_order_id::text,
      'checkout-terminal:'||p_order_id::text||':expired'
    )
    on conflict do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.cancel_checkout_order(uuid,text,text) from public,anon,authenticated;
grant execute on function public.cancel_checkout_order(uuid,text,text) to service_role;
