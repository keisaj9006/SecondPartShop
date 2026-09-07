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
begin
  insert into public.payment_events(provider,provider_event_id,event_type,payload_ref)
  values(
    'stripe',
    p_event_id,
    'charge.dispute.closed',
    jsonb_build_object(
      'dispute_id',p_dispute_id,
      'status',p_status,
      'transfer_reversal_id',p_transfer_reversal_id
    )
  )
  on conflict(provider_event_id) do nothing;
  if not found then return false; end if;

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

  if case_row.id is null then return false; end if;
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
  return true;
end;
$$;

drop function if exists public.close_provider_payment_dispute(text,text,text);

revoke all on function public.close_provider_payment_dispute(text,text,text,text) from public;
revoke execute on function public.close_provider_payment_dispute(text,text,text,text) from anon;
revoke execute on function public.close_provider_payment_dispute(text,text,text,text) from authenticated;
grant execute on function public.close_provider_payment_dispute(text,text,text,text) to service_role;
