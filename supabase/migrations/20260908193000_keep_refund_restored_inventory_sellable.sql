create or replace function public.finalize_transaction_case_refund(
  p_case_id uuid,
  p_refund_id text,
  p_refund_pence integer,
  p_transfer_reversal_id text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  case_row record;
  item_row record;
  new_refunded integer;
  should_restore_stock boolean:=false;
begin
  select c.id,c.order_item_id,c.status,c.case_type,c.previous_fulfilment_status,
         oi.order_id,o.total_pence,o.refunded_pence,o.buyer_id,s.owner_id
  into case_row
  from public.transaction_cases c
  join public.order_items oi on oi.id=c.order_item_id
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  where c.id=p_case_id
  for update of c;

  if case_row.id is null then return false; end if;
  if case_row.status='resolved' and exists(
    select 1 from public.transaction_cases c
    where c.id=p_case_id and c.provider_refund_id=p_refund_id
  ) then return true; end if;
  if p_refund_pence<=0 then raise exception 'Refund amount must be positive.'; end if;

  select oi.part_id,oi.seller_id,oi.quantity,oi.refunded_at
  into item_row
  from public.order_items oi
  where oi.id=case_row.order_item_id
  for update;

  should_restore_stock:=
    case_row.case_type='cancellation'
    and case_row.previous_fulfilment_status in ('paid','preparing','ready_for_collection')
    and item_row.refunded_at is null;

  update public.transaction_cases
  set status='resolved',resolution='full_refund',provider_refund_id=p_refund_id,
      provider_transfer_reversal_id=p_transfer_reversal_id,resolved_at=now()
  where id=case_row.id;

  update public.order_items
  set fulfilment_status='refunded',
      payout_status=case when provider_transfer_id is not null then 'reversed' else 'blocked' end,
      refunded_at=coalesce(refunded_at,now())
  where id=case_row.order_item_id;

  if should_restore_stock then
    update public.parts
    set
      stock=stock+item_row.quantity,
      status=case
        when status in ('sold'::public.listing_status,'reserved'::public.listing_status)
             and public.seller_checkout_ready(item_row.seller_id)
          then 'active'::public.listing_status
        when status in ('sold'::public.listing_status,'reserved'::public.listing_status)
          then 'draft'::public.listing_status
        else status
      end
    where id=item_row.part_id;
  end if;

  new_refunded:=least(case_row.total_pence,case_row.refunded_pence+p_refund_pence);
  update public.orders
  set refunded_pence=new_refunded,
      payment_status=case when new_refunded>=total_pence then 'refunded' else 'partially_refunded' end,
      status=case when new_refunded>=total_pence then 'refunded' else 'partially_refunded' end
  where id=case_row.order_id;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(case_row.buyer_id,'return_update','Refund issued',
    'Your SecondPart transaction case was approved for a refund.','/account/cases',
    'case-refund:'||case_row.id::text||':buyer')
  on conflict do nothing;

  if case_row.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(case_row.owner_id,'return_update','Transaction refunded',
      'A refund was issued for this transaction.','/dashboard/cases',
      'case-refund:'||case_row.id::text||':seller')
    on conflict do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.finalize_transaction_case_refund(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.finalize_transaction_case_refund(uuid,text,integer,text) to service_role;
