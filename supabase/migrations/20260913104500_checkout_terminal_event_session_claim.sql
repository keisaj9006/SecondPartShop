-- A signed Stripe terminal Checkout event can race the application between
-- provider session creation and local session attachment. Claim that missing
-- correlation under the order lock before cancelling, while refusing stale
-- events for a different attached session or any settled financial state.

create or replace function public.cancel_checkout_order_from_provider_event(
  p_order_id uuid,
  p_session_id text,
  p_event_id text,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  stored_session text;
  old_payment text;
begin
  if p_event_type not in ('checkout.session.expired','checkout.session.async_payment_failed') then
    raise exception 'Only terminal Stripe Checkout events may use this cancellation path.';
  end if;
  if nullif(btrim(coalesce(p_session_id,'')),'') is null then
    raise exception 'Stripe Checkout Session is required.';
  end if;
  if nullif(btrim(coalesce(p_event_id,'')),'') is null then
    raise exception 'Stripe event id is required.';
  end if;

  select provider_checkout_session_id,payment_status
  into stored_session,old_payment
  from public.orders
  where id=p_order_id
  for update;

  if not found then return false; end if;

  -- Provider terminal events must never release stock from a financially
  -- settled order. A later/stale event for another attached session also has
  -- no authority over the current reservation.
  if old_payment in ('paid','partially_refunded','refunded','disputed') then
    return false;
  end if;
  if stored_session is not null and stored_session<>p_session_id then
    return false;
  end if;

  -- If session creation succeeded at Stripe but the application had not yet
  -- persisted the returned id, the signed terminal event is sufficient
  -- provider evidence to claim that correlation. This serializes against a
  -- concurrent attach or paid-confirmation path on the same order row.
  if stored_session is null and old_payment in ('unpaid','requires_action','processing') then
    update public.orders
    set provider_checkout_session_id=p_session_id
    where id=p_order_id;
  elsif stored_session is null and old_payment<>'cancelled' then
    return false;
  end if;

  return public.cancel_checkout_order(p_order_id,p_event_id,p_event_type);
end;
$$;

revoke all on function public.cancel_checkout_order_from_provider_event(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.cancel_checkout_order_from_provider_event(uuid,text,text,text) to service_role;
