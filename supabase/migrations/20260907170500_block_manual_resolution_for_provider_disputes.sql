create or replace function public.admin_reject_transaction_case(p_case_id uuid,p_notes text)
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

  select c.*,oi.order_id,oi.release_eligible_at,oi.funds_released_at,o.buyer_id,s.owner_id
  into case_row
  from public.transaction_cases c
  join public.order_items oi on oi.id=c.order_item_id
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  where c.id=p_case_id
  for update of c;

  if case_row.id is null then raise exception 'Case not found.'; end if;
  if case_row.provider_dispute_id is not null then
    raise exception 'Payment-provider disputes can only be closed by the provider outcome.';
  end if;
  if case_row.status not in ('open','seller_response','under_review') then raise exception 'Case is already closed.'; end if;

  update public.transaction_cases
  set status='rejected',resolution='no_refund',resolution_notes=nullif(left(btrim(coalesce(p_notes,'')),2000),''),
      resolved_by=actor,resolved_at=now()
  where id=case_row.id;

  update public.order_items
  set fulfilment_status=case_row.previous_fulfilment_status,
      payout_status=case when funds_released_at is not null then 'released' when release_eligible_at is not null then 'scheduled' else 'not_ready' end
  where id=case_row.order_item_id;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(case_row.buyer_id,'return_update','Transaction case resolved','The case was closed without a refund.','/account/cases','case-resolved:'||case_row.id::text||':buyer')
  on conflict do nothing;

  if case_row.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(case_row.owner_id,'return_update','Transaction case resolved','The case was closed without a refund.','/dashboard/cases','case-resolved:'||case_row.id::text||':seller')
    on conflict do nothing;
  end if;

  perform private.recompute_order_status(case_row.order_id);
  return true;
end;
$$;

create or replace function public.admin_prepare_transaction_case_refund(p_case_id uuid,p_notes text)
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

  select c.id,c.case_type,c.status,c.previous_fulfilment_status,c.provider_dispute_id
  into case_row
  from public.transaction_cases c
  where c.id=p_case_id
  for update;

  if case_row.id is null then raise exception 'Case not found.'; end if;
  if case_row.provider_dispute_id is not null then
    raise exception 'Payment-provider disputes must be resolved by the provider outcome.';
  end if;
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
  set status='under_review',resolution_notes=nullif(left(btrim(coalesce(p_notes,'')),2000),''),resolved_by=actor
  where id=p_case_id;

  return true;
end;
$$;
