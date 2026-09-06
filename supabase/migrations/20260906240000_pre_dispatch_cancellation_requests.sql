-- Paid-order cancellation request before dispatch.

alter table public.transaction_cases
  drop constraint if exists transaction_cases_case_type_check;
alter table public.transaction_cases
  add constraint transaction_cases_case_type_check
  check (case_type in ('return','dispute','cancellation'));

create or replace function public.open_transaction_case(
  p_order_item_id uuid,
  p_case_type text,
  p_reason text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  item record;
  new_case uuid;
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if p_case_type not in ('return','dispute','cancellation') then raise exception 'Choose return, dispute or cancellation.'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'Choose a reason.'; end if;
  if char_length(btrim(coalesce(p_details,'')))<10 then raise exception 'Add more detail.'; end if;

  select oi.id,oi.order_id,oi.fulfilment_status,oi.payout_status,o.buyer_id,o.payment_status,p.title,s.owner_id
  into item
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.parts p on p.id=oi.part_id
  join public.sellers s on s.id=oi.seller_id
  where oi.id=p_order_item_id
  for update of oi;

  if item.id is null or item.buyer_id<>actor then raise exception 'Purchase not found.'; end if;
  if item.payment_status not in ('paid','disputed') then raise exception 'This transaction is not eligible for a case.'; end if;
  if item.fulfilment_status in ('cancelled','refunded','returned') then raise exception 'This transaction is already closed.'; end if;
  if p_case_type='cancellation' and item.fulfilment_status not in ('paid','preparing','ready_for_collection') then
    raise exception 'Cancellation requests are only available before dispatch or collection.';
  end if;
  if exists(select 1 from public.transaction_cases c where c.order_item_id=item.id and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')) then
    raise exception 'A case is already open for this item.';
  end if;

  insert into public.transaction_cases(order_item_id,opened_by,case_type,reason,details,previous_fulfilment_status)
  values(item.id,actor,p_case_type,left(btrim(p_reason),120),left(btrim(p_details),2000),item.fulfilment_status)
  returning id into new_case;

  update public.order_items
  set
    fulfilment_status=case
      when p_case_type='return' then 'return_requested'
      when p_case_type='dispute' then 'dispute_open'
      else fulfilment_status
    end,
    return_requested_at=case when p_case_type='return' then coalesce(return_requested_at,now()) else return_requested_at end,
    dispute_opened_at=case when p_case_type='dispute' then coalesce(dispute_opened_at,now()) else dispute_opened_at end,
    payout_status=case when payout_status='released' then payout_status else 'blocked' end
  where id=item.id;

  if p_case_type='dispute' then
    update public.orders set status='disputed' where id=item.order_id;
  end if;

  insert into public.order_events(order_id,order_item_id,actor_profile_id,event_type,from_status,to_status,metadata)
  values(item.order_id,item.id,actor,
    case when p_case_type='cancellation' then 'cancellation_requested' else 'case_opened' end,
    item.fulfilment_status,
    case
      when p_case_type='return' then 'return_requested'
      when p_case_type='dispute' then 'dispute_open'
      else 'cancellation_requested'
    end,
    jsonb_build_object('case_id',new_case,'case_type',p_case_type,'reason',left(btrim(p_reason),120)));

  if item.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(item.owner_id,
      case when p_case_type='dispute' then 'dispute_update' else 'return_update' end,
      case
        when p_case_type='return' then 'Buyer opened a return request'
        when p_case_type='dispute' then 'Buyer opened a transaction dispute'
        else 'Buyer requested cancellation'
      end,
      left(item.title,240),'/dashboard/cases','case-opened:'||new_case::text||':seller')
    on conflict do nothing;
  end if;

  return new_case;
end;
$$;

revoke execute on function public.open_transaction_case(uuid,text,text,text) from public,anon;
grant execute on function public.open_transaction_case(uuid,text,text,text) to authenticated;

create or replace function public.admin_prepare_transaction_case_refund(
  p_case_id uuid,
  p_notes text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  case_row record;
begin
  if actor is null or not private.is_admin() then raise exception 'Administrator access required.'; end if;

  select c.id,c.case_type,c.status,c.previous_fulfilment_status
  into case_row
  from public.transaction_cases c
  where c.id=p_case_id
  for update;

  if case_row.id is null then raise exception 'Case not found.'; end if;
  if case_row.case_type='return' and case_row.status<>'returned' then
    raise exception 'The returned item must be confirmed received before the standard refund path.';
  end if;
  if case_row.case_type='dispute' and case_row.status not in ('open','seller_response','under_review') then
    raise exception 'This dispute is not available for refund review.';
  end if;
  if case_row.case_type='cancellation' and (
    case_row.status not in ('open','seller_response','under_review')
    or case_row.previous_fulfilment_status not in ('paid','preparing','ready_for_collection')
  ) then
    raise exception 'This cancellation is not available for refund review.';
  end if;

  update public.transaction_cases
  set status='under_review',
      resolution_notes=nullif(left(btrim(coalesce(p_notes,'')),2000),''),
      resolved_by=actor
  where id=p_case_id;

  return true;
end;
$$;

revoke execute on function public.admin_prepare_transaction_case_refund(uuid,text) from public,anon;
grant execute on function public.admin_prepare_transaction_case_refund(uuid,text) to authenticated;

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
  if case_row.status='resolved' and exists(select 1 from public.transaction_cases c where c.id=p_case_id and c.provider_refund_id=p_refund_id) then return true; end if;
  if p_refund_pence<=0 then raise exception 'Refund amount must be positive.'; end if;

  select oi.part_id,oi.quantity,oi.refunded_at
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
      status=case when status in ('sold'::public.listing_status,'reserved'::public.listing_status) then 'active'::public.listing_status else status end
    where id=item_row.part_id;
  end if;

  new_refunded:=least(case_row.total_pence,case_row.refunded_pence+p_refund_pence);
  update public.orders
  set refunded_pence=new_refunded,
      payment_status=case when new_refunded>=total_pence then 'refunded' else 'partially_refunded' end,
      status=case when new_refunded>=total_pence then 'refunded' else 'partially_refunded' end
  where id=case_row.order_id;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(case_row.buyer_id,'return_update','Refund issued','Your SecondPart transaction case was approved for a refund.','/account/cases',
    'case-refund:'||case_row.id::text||':buyer')
  on conflict do nothing;

  if case_row.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(case_row.owner_id,'return_update','Transaction refunded','A refund was issued for this transaction.','/dashboard/cases',
      'case-refund:'||case_row.id::text||':seller')
    on conflict do nothing;
  end if;

  return true;
end;
$$;

revoke execute on function public.finalize_transaction_case_refund(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.finalize_transaction_case_refund(uuid,text,integer,text) to service_role;
