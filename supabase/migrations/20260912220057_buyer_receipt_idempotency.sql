-- A buyer's first explicit receipt starts the Buyer Protection window.
-- Retrying the same action must not move that deadline or disturb a payout
-- already claimed by the provider worker.

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
  actor uuid:=(select auth.uid());
  accept_now boolean:=coalesce(p_accept_now,false);
  item record;
  settings_row record;
  next_status text;
  eligibility timestamptz;
begin
  if actor is null then raise exception 'Authentication required.'; end if;

  select
    oi.id,oi.order_id,oi.fulfilment_status,oi.payout_status,
    oi.buyer_received_at,oi.delivered_at,oi.accepted_at,
    oi.release_eligible_at,oi.funds_released_at,
    o.buyer_id,o.payment_status,p.title,s.owner_id
  into item
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.parts p on p.id=oi.part_id
  join public.sellers s on s.id=oi.seller_id
  where oi.id=p_order_item_id
  for update of oi;

  if item.id is null or item.buyer_id is distinct from actor then raise exception 'Purchase not found.'; end if;
  if item.payment_status<>'paid' then raise exception 'The order has not been paid.'; end if;
  if item.fulfilment_status not in ('dispatched','ready_for_collection','delivered','accepted') then
    raise exception 'This item is not ready for receipt confirmation.';
  end if;

  -- Both actions are semantic transitions. Once achieved, their retries are
  -- successful no-ops: no timestamps, deadline, payout state, event or notice
  -- changes. Received after Accept is also a no-op so it cannot downgrade it.
  if item.fulfilment_status='accepted' or item.accepted_at is not null then return true; end if;
  if not accept_now and item.buyer_received_at is not null then return true; end if;

  if exists(
    select 1
    from public.transaction_cases c
    where c.order_item_id=item.id
      and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
  ) then
    raise exception 'An active transaction case blocks receipt acceptance.';
  end if;

  if item.payout_status in ('blocked','reversed') then
    raise exception 'This payout cannot be scheduled from its current state.';
  end if;
  if item.payout_status not in ('not_ready','scheduled','releasing','released') then
    raise exception 'This payout cannot be updated from its current state.';
  end if;

  -- A released payout is terminal. Preserve it rather than manufacturing a
  -- post-release receipt transition on an inconsistent legacy row.
  if item.payout_status='released' or item.funds_released_at is not null then return true; end if;

  select * into settings_row
  from public.commerce_settings
  where singleton=true;

  next_status:=case when accept_now then 'accepted' else 'delivered' end;
  eligibility:=case
    -- A claimed transfer is already eligible. Accept may record the buyer's
    -- decision, but it must not rewrite the worker's claim inputs.
    when item.payout_status='releasing' then item.release_eligible_at
    when accept_now then now()
    -- Preserve any earlier valid release window (for example, one started by
    -- an approved unverified-delivery review).
    else coalesce(item.release_eligible_at,now()+(settings_row.auto_release_hours||' hours')::interval)
  end;

  update public.order_items
  set
    fulfilment_status=next_status,
    buyer_received_at=coalesce(buyer_received_at,now()),
    delivered_at=coalesce(delivered_at,now()),
    accepted_at=case when accept_now then coalesce(accepted_at,now()) else accepted_at end,
    release_eligible_at=eligibility,
    payout_status=case when payout_status='not_ready' then 'scheduled' else payout_status end
  where id=item.id;

  insert into public.order_events(order_id,order_item_id,actor_profile_id,event_type,from_status,to_status,metadata)
  values(item.order_id,item.id,actor,
    case when accept_now then 'buyer_accepted' else 'buyer_received' end,
    item.fulfilment_status,next_status,
    jsonb_build_object('release_eligible_at',eligibility));

  if item.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      item.owner_id,
      case when accept_now then 'order_accepted' else 'order_received' end,
      case when accept_now then 'Buyer accepted the item' else 'Buyer confirmed delivery' end,
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

revoke all on function public.buyer_mark_order_item_received(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.buyer_mark_order_item_received(uuid,boolean) to authenticated;
