create table if not exists public.transaction_cases (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  case_type text not null check (case_type in ('return','dispute')),
  reason text not null check (char_length(reason) between 3 and 120),
  details text not null check (char_length(details) between 10 and 2000),
  status text not null default 'open'
    check (status in ('open','seller_response','under_review','resolved','rejected','cancelled')),
  previous_fulfilment_status text not null,
  seller_response text check (seller_response is null or char_length(seller_response)<=2000),
  resolution text check (resolution is null or resolution in ('full_refund','no_refund','other')),
  resolution_notes text check (resolution_notes is null or char_length(resolution_notes)<=2000),
  provider_refund_id text,
  provider_transfer_reversal_id text,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists transaction_cases_one_open_per_item
  on public.transaction_cases(order_item_id)
  where status in ('open','seller_response','under_review');

create index if not exists transaction_cases_status_created_idx
  on public.transaction_cases(status,created_at desc);
create index if not exists transaction_cases_opened_by_idx
  on public.transaction_cases(opened_by,created_at desc);

alter table public.transaction_cases enable row level security;

drop policy if exists "transaction cases participant read" on public.transaction_cases;
create policy "transaction cases participant read"
  on public.transaction_cases for select
  to authenticated
  using (private.can_read_order_item(order_item_id) or private.is_admin());

revoke all on public.transaction_cases from anon,authenticated;
grant select on public.transaction_cases to authenticated;

drop trigger if exists transaction_cases_touch on public.transaction_cases;
create trigger transaction_cases_touch
before update on public.transaction_cases
for each row execute function private.touch_updated_at();

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
  if p_case_type not in ('return','dispute') then raise exception 'Choose return or dispute.'; end if;
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
  if exists(select 1 from public.transaction_cases c where c.order_item_id=item.id and c.status in ('open','seller_response','under_review')) then
    raise exception 'A case is already open for this item.';
  end if;

  insert into public.transaction_cases(order_item_id,opened_by,case_type,reason,details,previous_fulfilment_status)
  values(item.id,actor,p_case_type,left(btrim(p_reason),120),left(btrim(p_details),2000),item.fulfilment_status)
  returning id into new_case;

  update public.order_items
  set
    fulfilment_status=case when p_case_type='return' then 'return_requested' else 'dispute_open' end,
    return_requested_at=case when p_case_type='return' then coalesce(return_requested_at,now()) else return_requested_at end,
    dispute_opened_at=case when p_case_type='dispute' then coalesce(dispute_opened_at,now()) else dispute_opened_at end,
    payout_status=case when payout_status='released' then payout_status else 'blocked' end
  where id=item.id;

  if p_case_type='dispute' then
    update public.orders set status='disputed' where id=item.order_id;
  end if;

  insert into public.order_events(order_id,order_item_id,actor_profile_id,event_type,from_status,to_status,metadata)
  values(item.order_id,item.id,actor,'case_opened',item.fulfilment_status,
    case when p_case_type='return' then 'return_requested' else 'dispute_open' end,
    jsonb_build_object('case_id',new_case,'case_type',p_case_type,'reason',left(btrim(p_reason),120)));

  if item.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(item.owner_id,
      case when p_case_type='return' then 'return_update' else 'dispute_update' end,
      case when p_case_type='return' then 'Buyer opened a return request' else 'Buyer opened a transaction dispute' end,
      left(item.title,240),'/dashboard/cases','case-opened:'||new_case::text||':seller')
    on conflict do nothing;
  end if;

  return new_case;
end;
$$;

revoke all on function public.open_transaction_case(uuid,text,text,text) from public;
grant execute on function public.open_transaction_case(uuid,text,text,text) to authenticated;

create or replace function public.seller_respond_transaction_case(
  p_case_id uuid,
  p_response text
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
  if char_length(btrim(coalesce(p_response,'')))<10 then raise exception 'Add more detail to your response.'; end if;

  select c.id,c.status,c.order_item_id,o.buyer_id,s.owner_id
  into case_row
  from public.transaction_cases c
  join public.order_items oi on oi.id=c.order_item_id
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  where c.id=p_case_id
  for update of c;

  if case_row.id is null or (case_row.owner_id<>actor and not private.is_admin()) then raise exception 'Case not found.'; end if;
  if case_row.status not in ('open','seller_response','under_review') then raise exception 'This case is already closed.'; end if;

  update public.transaction_cases
  set seller_response=left(btrim(p_response),2000),status='seller_response'
  where id=case_row.id;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(case_row.buyer_id,'return_update','Seller responded to your transaction case','Open the case to review the response.','/account/cases',
    'case-response:'||case_row.id::text)
  on conflict do nothing;

  return true;
end;
$$;

revoke all on function public.seller_respond_transaction_case(uuid,text) from public;
grant execute on function public.seller_respond_transaction_case(uuid,text) to authenticated;

create or replace function public.admin_reject_transaction_case(
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

  select c.*,oi.order_id,oi.release_eligible_at,oi.funds_released_at,o.buyer_id,s.owner_id
  into case_row
  from public.transaction_cases c
  join public.order_items oi on oi.id=c.order_item_id
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  where c.id=p_case_id
  for update of c;

  if case_row.id is null then raise exception 'Case not found.'; end if;
  if case_row.status not in ('open','seller_response','under_review') then raise exception 'Case is already closed.'; end if;

  update public.transaction_cases
  set status='rejected',resolution='no_refund',resolution_notes=nullif(left(btrim(coalesce(p_notes,'')),2000),''),
      resolved_by=actor,resolved_at=now()
  where id=case_row.id;

  update public.order_items
  set
    fulfilment_status=case_row.previous_fulfilment_status,
    payout_status=case
      when funds_released_at is not null then 'released'
      when release_eligible_at is not null then 'scheduled'
      else 'not_ready'
    end
  where id=case_row.order_item_id;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(case_row.buyer_id,'return_update','Transaction case resolved','The case was closed without a refund.','/account/cases',
    'case-resolved:'||case_row.id::text||':buyer')
  on conflict do nothing;

  if case_row.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(case_row.owner_id,'return_update','Transaction case resolved','The case was closed without a refund.','/dashboard/cases',
      'case-resolved:'||case_row.id::text||':seller')
    on conflict do nothing;
  end if;

  perform private.recompute_order_status(case_row.order_id);
  return true;
end;
$$;

revoke all on function public.admin_reject_transaction_case(uuid,text) from public;
grant execute on function public.admin_reject_transaction_case(uuid,text) to authenticated;

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
  new_refunded integer;
begin
  select c.id,c.order_item_id,c.status,oi.order_id,o.total_pence,o.refunded_pence,o.buyer_id,s.owner_id
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

  update public.transaction_cases
  set
    status='resolved',
    resolution='full_refund',
    provider_refund_id=p_refund_id,
    provider_transfer_reversal_id=p_transfer_reversal_id,
    resolved_at=now()
  where id=case_row.id;

  update public.order_items
  set
    fulfilment_status='refunded',
    payout_status=case when provider_transfer_id is not null then 'reversed' else 'blocked' end,
    refunded_at=coalesce(refunded_at,now())
  where id=case_row.order_item_id;

  new_refunded:=least(case_row.total_pence,case_row.refunded_pence+p_refund_pence);
  update public.orders
  set
    refunded_pence=new_refunded,
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

revoke all on function public.finalize_transaction_case_refund(uuid,text,integer,text) from public;
grant execute on function public.finalize_transaction_case_refund(uuid,text,integer,text) to service_role;
