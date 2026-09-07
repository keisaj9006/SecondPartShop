alter table public.order_items
  add column if not exists payout_rollback_required boolean not null default false,
  add column if not exists provider_transfer_reversal_id text;

create index if not exists order_items_payout_rollback_required_idx
  on public.order_items(id)
  where payout_rollback_required=true;

create or replace function public.claim_order_item_payout_release(p_order_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare item record;
begin
  select oi.id,oi.payout_status,oi.release_eligible_at,oi.funds_released_at,oi.payout_rollback_required,o.payment_status
  into item
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  where oi.id=p_order_item_id
  for update of oi;

  if item.id is null then return false; end if;
  if item.payout_rollback_required then return false; end if;
  if item.payout_status='released' then return true; end if;
  if item.payout_status='releasing' then return true; end if;
  if item.payout_status<>'scheduled' then return false; end if;
  if item.funds_released_at is not null then return false; end if;
  if item.release_eligible_at is null or item.release_eligible_at>now() then return false; end if;
  if item.payment_status<>'paid' then return false; end if;
  if exists(
    select 1 from public.transaction_cases c
    where c.order_item_id=p_order_item_id
      and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
  ) then return false; end if;

  update public.order_items set payout_status='releasing' where id=p_order_item_id;
  return true;
end;
$$;

create or replace function public.get_due_payout_order_items(p_limit integer default 100)
returns table(order_item_id uuid)
language sql
security definer
set search_path=''
as $$
  select oi.id
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  where oi.payout_status in ('scheduled','releasing')
    and oi.payout_rollback_required=false
    and oi.release_eligible_at is not null
    and oi.release_eligible_at<=now()
    and oi.funds_released_at is null
    and o.payment_status='paid'
    and not exists(
      select 1 from public.transaction_cases c
      where c.order_item_id=oi.id
        and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
    )
  order by oi.release_eligible_at
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

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
  if item.payout_rollback_required then raise exception 'Payout transfer rollback is pending.'; end if;
  if item.payout_status<>'releasing' then raise exception 'Payout release was not claimed.'; end if;
  if item.release_eligible_at is null or item.release_eligible_at>now() then raise exception 'Payout is not eligible for release.'; end if;
  if item.payment_status<>'paid' then raise exception 'Order payment is not eligible for payout.'; end if;
  if nullif(btrim(coalesce(p_transfer_id,'')),'') is null then raise exception 'Transfer id is required.'; end if;
  if item.provider_transfer_id is not null and item.provider_transfer_id<>p_transfer_id then raise exception 'Transfer id does not match the recorded payout transfer.'; end if;
  if exists(
    select 1 from public.transaction_cases c
    where c.order_item_id=item.id
      and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
  ) then
    update public.order_items set payout_status='blocked' where id=item.id;
    raise exception 'Payout is blocked by an active transaction case.';
  end if;

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
