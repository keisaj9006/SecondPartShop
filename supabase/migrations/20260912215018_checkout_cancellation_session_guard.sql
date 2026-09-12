-- Stripe expiry must be established by the service before this call. Lock the
-- exact session snapshot across the existing cancellation/stock transaction so
-- a stale cancellation cannot affect a different session or a paid order.
create or replace function public.cancel_checkout_order_if_session_matches(
  p_order_id uuid,
  p_expected_session_id text,
  p_buyer_id uuid default null,
  p_event_id text default null,
  p_event_type text default 'checkout_cancelled'
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  stored_session text;
  stored_buyer uuid;
begin
  select provider_checkout_session_id,buyer_id
  into stored_session,stored_buyer
  from public.orders
  where id=p_order_id
  for update;

  if not found then return false; end if;
  if stored_session is distinct from p_expected_session_id then return false; end if;
  -- Webhooks/reconciliation have no buyer principal. Browser/mobile callers
  -- pass their authenticated buyer, which is checked again under the lock.
  if p_buyer_id is not null and stored_buyer is distinct from p_buyer_id then return false; end if;

  return public.cancel_checkout_order(p_order_id,p_event_id,p_event_type);
end;
$$;

revoke all on function public.cancel_checkout_order_if_session_matches(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.cancel_checkout_order_if_session_matches(uuid,text,uuid,text,text) to service_role;

-- The original primitive is retained for the database-only null-session timer.
revoke all on function public.cancel_checkout_order(uuid,text,text) from public,anon,authenticated;
grant execute on function public.cancel_checkout_order(uuid,text,text) to service_role;
