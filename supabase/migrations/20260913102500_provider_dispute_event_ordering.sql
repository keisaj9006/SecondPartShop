-- Make provider dispute webhooks retry-safe: only consume an event after its
-- order/case outcome has been durably applied, while recovering historical
-- orphan event rows created by the earlier consume-before-link implementation.

create or replace function public.open_provider_payment_dispute(
  p_event_id text,
  p_dispute_id text,
  p_charge_id text,
  p_status text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  order_row record;
  item_row record;
  existing_case record;
  case_id uuid;
  event_provider text;
  event_type_value text;
  event_payload jsonb;
  event_exists boolean:=false;
begin
  select pe.provider,pe.event_type,pe.payload_ref
  into event_provider,event_type_value,event_payload
  from public.payment_events pe
  where pe.provider_event_id=p_event_id;
  event_exists:=found;

  if event_exists and (
    event_provider is distinct from 'stripe'
    or event_type_value is distinct from 'charge.dispute.created'
    or event_payload->>'dispute_id' is distinct from p_dispute_id
    or event_payload->>'charge_id' is distinct from p_charge_id
  ) then
    raise exception 'Provider event id is already linked to a different dispute event.';
  end if;

  -- Durable case authority wins over delivery duplication. Record a missing
  -- event row, but never append another semantic order event or case note.
  select c.id into case_id
  from public.transaction_cases c
  where c.provider_dispute_id=p_dispute_id;

  if case_id is not null then
    insert into public.payment_events(provider,provider_event_id,event_type,payload_ref)
    values(
      'stripe',p_event_id,'charge.dispute.created',
      jsonb_build_object('dispute_id',p_dispute_id,'charge_id',p_charge_id,'status',p_status,'reason',p_reason)
    )
    on conflict(provider_event_id) do nothing;
    return case_id;
  end if;

  -- This row lock serialises duplicate/different delivery IDs for the same
  -- charge. Missing linkage is an error so the webhook returns non-2xx and the
  -- provider can retry; no payment_events row is consumed in that transaction.
  select o.id,o.buyer_id,o.payment_status
  into order_row
  from public.orders o
  where o.provider_charge_id=p_charge_id
  for update;

  if order_row.id is null then
    raise exception 'Provider dispute cannot be linked to an order yet.';
  end if;

  -- Re-check after the order lock because another delivery may have completed
  -- while this call was waiting.
  select c.id into case_id
  from public.transaction_cases c
  where c.provider_dispute_id=p_dispute_id;

  if case_id is not null then
    insert into public.payment_events(provider,provider_event_id,event_type,payload_ref)
    values(
      'stripe',p_event_id,'charge.dispute.created',
      jsonb_build_object('dispute_id',p_dispute_id,'charge_id',p_charge_id,'status',p_status,'reason',p_reason)
    )
    on conflict(provider_event_id) do nothing;
    return case_id;
  end if;

  select oi.id,oi.fulfilment_status,oi.payout_status,oi.funds_released_at,s.owner_id,p.title
  into item_row
  from public.order_items oi
  join public.sellers s on s.id=oi.seller_id
  join public.parts p on p.id=oi.part_id
  where oi.order_id=order_row.id
  order by oi.id
  limit 1
  for update of oi;

  if item_row.id is null then
    raise exception 'Provider dispute order item is not available yet.';
  end if;

  select c.*
  into existing_case
  from public.transaction_cases c
  where c.order_item_id=item_row.id
    and c.status in (
      'open','seller_response','under_review',
      'return_authorized','return_shipped','returned'
    )
  order by c.created_at desc
  limit 1
  for update;

  if existing_case.id is not null then
    if existing_case.provider_dispute_id is not null
       and existing_case.provider_dispute_id<>p_dispute_id then
      raise exception 'Another provider dispute is already attached to this active transaction case.';
    end if;

    case_id:=existing_case.id;
    update public.transaction_cases
    set
      status='under_review',
      provider_dispute_id=p_dispute_id,
      provider_dispute_status=left(coalesce(p_status,'unknown'),80),
      provider_dispute_reason=nullif(left(coalesce(p_reason,''),120),''),
      resolution_notes=coalesce(resolution_notes,'')||
        case when coalesce(resolution_notes,'')='' then '' else E'\n' end||
        'Stripe card dispute opened.'
    where id=case_id;
  else
    insert into public.transaction_cases(
      order_item_id,opened_by,case_type,reason,details,status,previous_fulfilment_status,
      provider_dispute_id,provider_dispute_status,provider_dispute_reason
    )
    values(
      item_row.id,null,'dispute',
      coalesce(nullif(left(coalesce(p_reason,''),120),''),'Card payment dispute'),
      'A cardholder dispute was opened through the payment provider.',
      'under_review',item_row.fulfilment_status,
      p_dispute_id,left(coalesce(p_status,'unknown'),80),nullif(left(coalesce(p_reason,''),120),'')
    )
    returning id into case_id;
  end if;

  update public.order_items
  set
    fulfilment_status=case when fulfilment_status in ('refunded','cancelled') then fulfilment_status else 'dispute_open' end,
    dispute_opened_at=coalesce(dispute_opened_at,now()),
    payout_status=case when funds_released_at is not null then payout_status else 'blocked' end
  where id=item_row.id;

  update public.orders
  set status='disputed',payment_status='disputed'
  where id=order_row.id;

  insert into public.order_events(order_id,order_item_id,event_type,from_status,to_status,metadata)
  values(
    order_row.id,item_row.id,'provider_dispute_opened',order_row.payment_status,'disputed',
    jsonb_build_object('case_id',case_id,'provider_dispute_id',p_dispute_id,'provider_status',p_status,'reason',p_reason)
  );

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(
    order_row.buyer_id,'dispute_update','Card payment dispute opened',
    left(item_row.title,240),'/account/cases','provider-dispute:'||p_dispute_id||':buyer'
  )
  on conflict do nothing;

  if item_row.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      item_row.owner_id,'dispute_update','Payment-provider dispute opened',
      left(item_row.title,240),'/dashboard/cases','provider-dispute:'||p_dispute_id||':seller'
    )
    on conflict do nothing;
  end if;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  select p.id,'dispute_update','Payment-provider dispute needs review',
    left(item_row.title,240),'/admin/commerce','provider-dispute:'||p_dispute_id||':admin:'||p.id::text
  from public.profiles p
  where p.role='admin'
  on conflict do nothing;

  -- Consume only after all durable state above succeeded. ON CONFLICT also
  -- repairs historical orphan event rows: the outcome is applied, then the old
  -- event row is simply reused.
  insert into public.payment_events(provider,provider_event_id,event_type,payload_ref)
  values(
    'stripe',p_event_id,'charge.dispute.created',
    jsonb_build_object('dispute_id',p_dispute_id,'charge_id',p_charge_id,'status',p_status,'reason',p_reason)
  )
  on conflict(provider_event_id) do nothing;

  return case_id;
end;
$$;

create or replace function public.close_provider_payment_dispute(
  p_event_id text,
  p_dispute_id text,
  p_status text,
  p_transfer_reversal_id text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  case_row record;
  order_id_value uuid;
  seller_owner uuid;
  lost_outcome boolean:=lower(coalesce(p_status,''))='lost';
  won_outcome boolean:=lower(coalesce(p_status,'')) in ('won','warning_closed');
  event_provider text;
  event_type_value text;
  event_payload jsonb;
  event_exists boolean:=false;
begin
  select pe.provider,pe.event_type,pe.payload_ref
  into event_provider,event_type_value,event_payload
  from public.payment_events pe
  where pe.provider_event_id=p_event_id;
  event_exists:=found;

  if event_exists and (
    event_provider is distinct from 'stripe'
    or event_type_value is distinct from 'charge.dispute.closed'
    or event_payload->>'dispute_id' is distinct from p_dispute_id
  ) then
    raise exception 'Provider event id is already linked to a different dispute event.';
  end if;

  select
    c.*,
    oi.order_id,
    oi.funds_released_at,
    oi.release_eligible_at,
    oi.provider_transfer_id,
    oi.provider_transfer_reversal_id as existing_transfer_reversal_id,
    o.buyer_id,
    s.owner_id
  into case_row
  from public.transaction_cases c
  join public.order_items oi on oi.id=c.order_item_id
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  where c.provider_dispute_id=p_dispute_id
  for update of c;

  if case_row.id is null then
    raise exception 'Provider dispute close cannot be linked to a transaction case yet.';
  end if;

  -- A replay after a durable close is an acknowledgement, not a second
  -- semantic transition. This also prevents webhook retry loops.
  if case_row.status='resolved'
     and lower(coalesce(case_row.provider_dispute_status,''))=lower(coalesce(p_status,'')) then
    insert into public.payment_events(provider,provider_event_id,event_type,payload_ref)
    values(
      'stripe',p_event_id,'charge.dispute.closed',
      jsonb_build_object(
        'dispute_id',p_dispute_id,
        'status',p_status,
        'transfer_reversal_id',p_transfer_reversal_id
      )
    )
    on conflict(provider_event_id) do nothing;
    return true;
  end if;

  order_id_value:=case_row.order_id;
  seller_owner:=case_row.owner_id;

  if lost_outcome
     and case_row.funds_released_at is not null
     and case_row.provider_transfer_id is not null
     and coalesce(case_row.existing_transfer_reversal_id,p_transfer_reversal_id) is null then
    raise exception 'Released seller transfer must be reversed before closing a lost provider dispute.';
  end if;

  update public.transaction_cases
  set
    provider_dispute_status=left(coalesce(p_status,'unknown'),80),
    provider_transfer_reversal_id=coalesce(provider_transfer_reversal_id,p_transfer_reversal_id),
    status='resolved',
    resolution='other',
    resolution_notes=coalesce(resolution_notes,'')||
      case when coalesce(resolution_notes,'')='' then '' else E'\n' end||
      'Stripe card dispute closed with status: '||left(coalesce(p_status,'unknown'),80),
    resolved_at=now()
  where id=case_row.id;

  if won_outcome then
    update public.orders
    set payment_status='paid'
    where id=order_id_value;

    update public.order_items
    set
      fulfilment_status=case
        when fulfilment_status='dispute_open' then case_row.previous_fulfilment_status
        else fulfilment_status
      end,
      payout_status=case
        when funds_released_at is not null then 'released'
        when release_eligible_at is not null then 'scheduled'
        else 'not_ready'
      end,
      payout_rollback_required=false
    where id=case_row.order_item_id;

  elsif lost_outcome then
    update public.orders
    set payment_status='disputed',status='disputed'
    where id=order_id_value;

    update public.order_items
    set
      fulfilment_status=case
        when fulfilment_status in ('refunded','cancelled') then fulfilment_status
        else 'dispute_resolved'
      end,
      payout_status=case
        when funds_released_at is not null and provider_transfer_id is not null then 'reversed'
        else 'blocked'
      end,
      provider_transfer_reversal_id=coalesce(provider_transfer_reversal_id,p_transfer_reversal_id),
      payout_rollback_required=false
    where id=case_row.order_item_id;

  else
    update public.orders
    set payment_status='disputed',status='disputed'
    where id=order_id_value;

    update public.order_items
    set
      fulfilment_status=case
        when fulfilment_status in ('refunded','cancelled') then fulfilment_status
        else 'dispute_resolved'
      end,
      payout_status=case
        when funds_released_at is not null then payout_status
        else 'blocked'
      end
    where id=case_row.order_item_id;
  end if;

  insert into public.order_events(order_id,order_item_id,event_type,to_status,metadata)
  values(
    order_id_value,
    case_row.order_item_id,
    'provider_dispute_closed',
    left(coalesce(p_status,'unknown'),80),
    jsonb_build_object(
      'case_id',case_row.id,
      'provider_dispute_id',p_dispute_id,
      'provider_status',p_status,
      'transfer_reversal_id',p_transfer_reversal_id
    )
  );

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(
    case_row.buyer_id,
    'dispute_update',
    'Card payment dispute closed',
    'Provider outcome: '||left(coalesce(p_status,'unknown'),80),
    '/account/cases',
    'provider-dispute-closed:'||p_dispute_id||':buyer'
  )
  on conflict do nothing;

  if seller_owner is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      seller_owner,
      'dispute_update',
      'Payment-provider dispute closed',
      'Provider outcome: '||left(coalesce(p_status,'unknown'),80),
      '/dashboard/cases',
      'provider-dispute-closed:'||p_dispute_id||':seller'
    )
    on conflict do nothing;
  end if;

  perform private.recompute_order_status(order_id_value);

  insert into public.payment_events(provider,provider_event_id,event_type,payload_ref)
  values(
    'stripe',p_event_id,'charge.dispute.closed',
    jsonb_build_object(
      'dispute_id',p_dispute_id,
      'status',p_status,
      'transfer_reversal_id',p_transfer_reversal_id
    )
  )
  on conflict(provider_event_id) do nothing;

  return true;
end;
$$;

revoke all on function public.open_provider_payment_dispute(text,text,text,text,text) from public;
revoke execute on function public.open_provider_payment_dispute(text,text,text,text,text) from anon;
revoke execute on function public.open_provider_payment_dispute(text,text,text,text,text) from authenticated;
grant execute on function public.open_provider_payment_dispute(text,text,text,text,text) to service_role;

revoke all on function public.close_provider_payment_dispute(text,text,text,text) from public;
revoke execute on function public.close_provider_payment_dispute(text,text,text,text) from anon;
revoke execute on function public.close_provider_payment_dispute(text,text,text,text) from authenticated;
grant execute on function public.close_provider_payment_dispute(text,text,text,text) to service_role;
