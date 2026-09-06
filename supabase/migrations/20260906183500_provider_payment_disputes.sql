-- Synchronise provider/card disputes with SecondPart transaction cases.

alter table public.transaction_cases
  alter column opened_by drop not null;

alter table public.transaction_cases
  add column if not exists provider_dispute_id text,
  add column if not exists provider_dispute_status text,
  add column if not exists provider_dispute_reason text;

create unique index if not exists transaction_cases_provider_dispute_unique
  on public.transaction_cases(provider_dispute_id)
  where provider_dispute_id is not null;

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
begin
  insert into public.payment_events(provider,provider_event_id,event_type,payload_ref)
  values('stripe',p_event_id,'charge.dispute.created',
    jsonb_build_object('dispute_id',p_dispute_id,'charge_id',p_charge_id,'status',p_status,'reason',p_reason))
  on conflict(provider_event_id) do nothing;

  if not found then
    select id into case_id from public.transaction_cases where provider_dispute_id=p_dispute_id;
    return case_id;
  end if;

  select id,buyer_id,payment_status into order_row
  from public.orders
  where provider_charge_id=p_charge_id
  for update;

  if order_row.id is null then
    return null;
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

  if item_row.id is null then return null; end if;

  select *
  into existing_case
  from public.transaction_cases c
  where c.order_item_id=item_row.id
    and c.status in ('open','seller_response','under_review')
  order by c.created_at desc
  limit 1
  for update;

  if existing_case.id is not null then
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
  values(order_row.id,item_row.id,'provider_dispute_opened',order_row.payment_status,'disputed',
    jsonb_build_object('case_id',case_id,'provider_dispute_id',p_dispute_id,'provider_status',p_status,'reason',p_reason));

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(order_row.buyer_id,'dispute_update','Card payment dispute opened',
    left(item_row.title,240),'/account/cases','provider-dispute:'||p_dispute_id||':buyer')
  on conflict do nothing;

  if item_row.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(item_row.owner_id,'dispute_update','Payment-provider dispute opened',
      left(item_row.title,240),'/dashboard/cases','provider-dispute:'||p_dispute_id||':seller')
    on conflict do nothing;
  end if;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  select p.id,'dispute_update','Payment-provider dispute needs review',
    left(item_row.title,240),'/admin/commerce','provider-dispute:'||p_dispute_id||':admin:'||p.id::text
  from public.profiles p
  where p.role='admin'
  on conflict do nothing;

  return case_id;
end;
$$;

revoke all on function public.open_provider_payment_dispute(text,text,text,text,text) from public;
grant execute on function public.open_provider_payment_dispute(text,text,text,text,text) to service_role;

create or replace function public.close_provider_payment_dispute(
  p_event_id text,
  p_dispute_id text,
  p_status text
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
begin
  insert into public.payment_events(provider,provider_event_id,event_type,payload_ref)
  values('stripe',p_event_id,'charge.dispute.closed',
    jsonb_build_object('dispute_id',p_dispute_id,'status',p_status))
  on conflict(provider_event_id) do nothing;
  if not found then return false; end if;

  select c.*,oi.order_id,oi.funds_released_at,oi.release_eligible_at,o.buyer_id,s.owner_id
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

  update public.transaction_cases
  set
    provider_dispute_status=left(coalesce(p_status,'unknown'),80),
    status='resolved',
    resolution='other',
    resolution_notes=coalesce(resolution_notes,'')||
      case when coalesce(resolution_notes,'')='' then '' else E'\n' end||
      'Stripe card dispute closed with status: '||left(coalesce(p_status,'unknown'),80),
    resolved_at=now()
  where id=case_row.id;

  if p_status in ('won','warning_closed') then
    update public.orders
    set payment_status='paid',status='processing'
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
      end
    where id=case_row.order_item_id;
  elsif p_status='lost' then
    update public.orders
    set payment_status='disputed',status='disputed'
    where id=order_id_value;

    update public.order_items
    set payout_status=case when funds_released_at is not null then 'released' else 'blocked' end
    where id=case_row.order_item_id;
  end if;

  insert into public.order_events(order_id,order_item_id,event_type,to_status,metadata)
  values(order_id_value,case_row.order_item_id,'provider_dispute_closed',p_status,
    jsonb_build_object('case_id',case_row.id,'provider_dispute_id',p_dispute_id,'provider_status',p_status));

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(case_row.buyer_id,'dispute_update','Card payment dispute closed',
    'Provider outcome: '||left(coalesce(p_status,'unknown'),80),'/account/cases',
    'provider-dispute-closed:'||p_dispute_id||':buyer')
  on conflict do nothing;

  if seller_owner is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(seller_owner,'dispute_update','Payment-provider dispute closed',
      'Provider outcome: '||left(coalesce(p_status,'unknown'),80),'/dashboard/cases',
      'provider-dispute-closed:'||p_dispute_id||':seller')
    on conflict do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.close_provider_payment_dispute(text,text,text) from public;
grant execute on function public.close_provider_payment_dispute(text,text,text) to service_role;
