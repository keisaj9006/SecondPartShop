create or replace function public.mark_order_item_payout_released(p_order_item_id uuid,p_transfer_id text)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare item record;
begin
  select oi.id,oi.order_id,oi.payout_status,oi.release_eligible_at,oi.funds_released_at,oi.provider_transfer_id,
         oi.payout_rollback_required,o.payment_status,o.buyer_id,p.title
  into item
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.parts p on p.id=oi.part_id
  where oi.id=p_order_item_id
  for update of oi;

  if item.id is null then return false; end if;
  if item.payout_status='released' then return true; end if;

  if exists(
    select 1 from public.transaction_cases c
    where c.order_item_id=item.id
      and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
  ) then
    update public.order_items
    set payout_status='blocked'
    where id=item.id and payout_status<>'released';
    return false;
  end if;

  if item.payout_rollback_required then raise exception 'Payout transfer rollback is pending.'; end if;
  if item.payout_status<>'releasing' then raise exception 'Payout release was not claimed.'; end if;
  if item.release_eligible_at is null or item.release_eligible_at>now() then raise exception 'Payout is not eligible for release.'; end if;
  if item.payment_status<>'paid' then raise exception 'Order payment is not eligible for payout.'; end if;
  if nullif(btrim(coalesce(p_transfer_id,'')),'') is null then raise exception 'Transfer id is required.'; end if;
  if item.provider_transfer_id is not null and item.provider_transfer_id<>p_transfer_id then raise exception 'Transfer id does not match the recorded payout transfer.'; end if;

  update public.order_items
  set payout_status='released',provider_transfer_id=coalesce(provider_transfer_id,p_transfer_id),
      funds_released_at=coalesce(funds_released_at,now()),fulfilment_status='completed'
  where id=item.id;

  insert into public.order_events(order_id,order_item_id,event_type,from_status,to_status,metadata)
  values(item.order_id,item.id,'seller_transfer_released',item.payout_status,'released',jsonb_build_object('transfer_id',p_transfer_id));

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(item.buyer_id,'order_update','Transaction completed',left(item.title,240),'/account/orders','transaction-complete:'||item.id::text)
  on conflict do nothing;

  perform private.recompute_order_status(item.order_id);
  return true;
end;
$$;
