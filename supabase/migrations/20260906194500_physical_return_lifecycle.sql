alter table public.transaction_cases
  drop constraint if exists transaction_cases_status_check;

alter table public.transaction_cases
  add constraint transaction_cases_status_check
  check (status in (
    'open','seller_response','under_review',
    'return_authorized','return_shipped','returned',
    'resolved','rejected','cancelled'
  ));

alter table public.transaction_cases
  add column if not exists return_tracking_carrier text,
  add column if not exists return_tracking_number text,
  add column if not exists return_authorized_at timestamptz,
  add column if not exists return_shipped_at timestamptz,
  add column if not exists return_received_at timestamptz;

alter table public.transaction_cases
  drop constraint if exists transaction_cases_return_tracking_lengths;
alter table public.transaction_cases
  add constraint transaction_cases_return_tracking_lengths
  check (
    (return_tracking_carrier is null or char_length(return_tracking_carrier)<=80)
    and (return_tracking_number is null or char_length(return_tracking_number)<=120)
  );

drop index if exists public.transaction_cases_one_open_per_item;
create unique index transaction_cases_one_open_per_item
  on public.transaction_cases(order_item_id)
  where status in (
    'open','seller_response','under_review',
    'return_authorized','return_shipped','returned'
  );

create or replace function public.admin_authorize_transaction_return(
  p_case_id uuid,
  p_notes text default null
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

  select c.id,c.case_type,c.status,c.order_item_id,o.buyer_id,s.owner_id
  into case_row
  from public.transaction_cases c
  join public.order_items oi on oi.id=c.order_item_id
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  where c.id=p_case_id
  for update of c;

  if case_row.id is null then raise exception 'Case not found.'; end if;
  if case_row.case_type<>'return' then raise exception 'Only return cases can be authorised for return shipping.'; end if;
  if case_row.status not in ('open','seller_response','under_review') then raise exception 'This return cannot be authorised in its current state.'; end if;

  update public.transaction_cases
  set
    status='return_authorized',
    return_authorized_at=coalesce(return_authorized_at,now()),
    resolution_notes=case
      when nullif(btrim(coalesce(p_notes,'')),'') is null then resolution_notes
      else left(btrim(p_notes),2000)
    end,
    resolved_by=actor
  where id=case_row.id;

  update public.order_items
  set fulfilment_status='return_approved',
      payout_status=case when funds_released_at is not null then payout_status else 'blocked' end
  where id=case_row.order_item_id;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(case_row.buyer_id,'return_update','Return authorised',
    'Send the item back and add the return shipment reference in SecondPart.',
    '/account/cases','return-authorised:'||case_row.id::text||':buyer')
  on conflict do nothing;

  if case_row.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(case_row.owner_id,'return_update','Return authorised',
      'The buyer can now record the return shipment.','/dashboard/cases',
      'return-authorised:'||case_row.id::text||':seller')
    on conflict do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.admin_authorize_transaction_return(uuid,text) from public;
grant execute on function public.admin_authorize_transaction_return(uuid,text) to authenticated;

create or replace function public.buyer_mark_transaction_return_shipped(
  p_case_id uuid,
  p_carrier text,
  p_tracking_number text
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
  if actor is null then raise exception 'Authentication required.'; end if;
  if char_length(btrim(coalesce(p_tracking_number,'')))<3 then raise exception 'Add a return shipment reference.'; end if;

  select c.id,c.status,c.order_item_id,o.buyer_id,s.owner_id
  into case_row
  from public.transaction_cases c
  join public.order_items oi on oi.id=c.order_item_id
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  where c.id=p_case_id
  for update of c;

  if case_row.id is null or case_row.buyer_id<>actor then raise exception 'Return case not found.'; end if;
  if case_row.status<>'return_authorized' then raise exception 'This return is not ready for shipment.'; end if;

  update public.transaction_cases
  set
    status='return_shipped',
    return_tracking_carrier=nullif(left(btrim(coalesce(p_carrier,'')),80),''),
    return_tracking_number=left(btrim(p_tracking_number),120),
    return_shipped_at=now()
  where id=case_row.id;

  if case_row.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(case_row.owner_id,'return_update','Buyer sent the return',
      'Return shipment reference: '||left(btrim(p_tracking_number),120),
      '/dashboard/cases','return-shipped:'||case_row.id::text||':seller')
    on conflict do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.buyer_mark_transaction_return_shipped(uuid,text,text) from public;
grant execute on function public.buyer_mark_transaction_return_shipped(uuid,text,text) to authenticated;

create or replace function public.seller_confirm_transaction_return_received(
  p_case_id uuid
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
  if actor is null then raise exception 'Authentication required.'; end if;

  select c.id,c.status,c.order_item_id,o.buyer_id,s.owner_id,p.title
  into case_row
  from public.transaction_cases c
  join public.order_items oi on oi.id=c.order_item_id
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  join public.parts p on p.id=oi.part_id
  where c.id=p_case_id
  for update of c;

  if case_row.id is null or (case_row.owner_id<>actor and not private.is_admin()) then raise exception 'Return case not found.'; end if;
  if case_row.status not in ('return_authorized','return_shipped') then raise exception 'This return is not awaiting seller receipt.'; end if;

  update public.transaction_cases
  set status='returned',return_received_at=now()
  where id=case_row.id;

  update public.order_items
  set fulfilment_status='returned',
      payout_status=case when funds_released_at is not null then payout_status else 'blocked' end
  where id=case_row.order_item_id;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(case_row.buyer_id,'return_update','Seller received your return',
    left(case_row.title,240),'/account/cases',
    'return-received:'||case_row.id::text||':buyer')
  on conflict do nothing;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  select p.id,'return_update','Returned item ready for refund review',
    left(case_row.title,240),'/admin/commerce',
    'return-ready-refund:'||case_row.id::text||':admin:'||p.id::text
  from public.profiles p
  where p.role='admin'
  on conflict do nothing;

  return true;
end;
$$;

revoke all on function public.seller_confirm_transaction_return_received(uuid) from public;
grant execute on function public.seller_confirm_transaction_return_received(uuid) to authenticated;

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

  select id,case_type,status
  into case_row
  from public.transaction_cases
  where id=p_case_id
  for update;

  if case_row.id is null then raise exception 'Case not found.'; end if;
  if case_row.case_type='return' and case_row.status<>'returned' then
    raise exception 'The returned item must be confirmed received before the standard refund path.';
  end if;
  if case_row.case_type='dispute' and case_row.status not in ('open','seller_response','under_review') then
    raise exception 'This dispute is not available for refund review.';
  end if;

  update public.transaction_cases
  set
    status='under_review',
    resolution_notes=nullif(left(btrim(coalesce(p_notes,'')),2000),''),
    resolved_by=actor
  where id=p_case_id;

  return true;
end;
$$;

revoke all on function public.admin_prepare_transaction_case_refund(uuid,text) from public;
grant execute on function public.admin_prepare_transaction_case_refund(uuid,text) to authenticated;

create or replace function public.admin_prepare_returnless_refund(
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
begin
  if actor is null or not private.is_admin() then raise exception 'Administrator access required.'; end if;
  if char_length(btrim(coalesce(p_notes,'')))<10 then
    raise exception 'Document why a returnless refund is appropriate.';
  end if;

  update public.transaction_cases
  set status='under_review',resolution_notes=left(btrim(p_notes),2000),resolved_by=actor
  where id=p_case_id
    and case_type='return'
    and status in ('open','seller_response','return_authorized','return_shipped');

  if not found then raise exception 'Return case is not available for a returnless refund.'; end if;
  return true;
end;
$$;

revoke all on function public.admin_prepare_returnless_refund(uuid,text) from public;
grant execute on function public.admin_prepare_returnless_refund(uuid,text) to authenticated;
