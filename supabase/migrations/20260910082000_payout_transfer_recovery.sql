-- Harden the distributed Stripe transfer -> database finalize boundary.
-- A payout can be claimed in Postgres, then the provider request can succeed while
-- the response/database write is interrupted. These service-only RPCs let the
-- worker recover that state without blindly creating a second seller transfer.

create or replace function public.get_releasing_payout_order_items(p_limit integer default 100)
returns table(order_item_id uuid)
language sql
security definer
set search_path=''
as $$
  select oi.id
  from public.order_items oi
  where oi.payout_status='releasing'
    and oi.funds_released_at is null
  order by oi.release_eligible_at nulls first,oi.id
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

revoke all on function public.get_releasing_payout_order_items(integer) from public,anon,authenticated,service_role;
grant execute on function public.get_releasing_payout_order_items(integer) to service_role;

create or replace function public.recover_order_item_payout_transfer(
  p_order_item_id uuid,
  p_transfer_id text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  item record;
  clean_transfer text:=nullif(btrim(coalesce(p_transfer_id,'')),'');
begin
  if clean_transfer is null then raise exception 'Transfer id is required.'; end if;

  select id,payout_status,funds_released_at,provider_transfer_id
  into item
  from public.order_items
  where id=p_order_item_id
  for update;

  if item.id is null then return false; end if;
  if item.funds_released_at is not null or item.payout_status='released' then return false; end if;
  if item.payout_status not in ('releasing','blocked') then return false; end if;
  if item.provider_transfer_id is not null and item.provider_transfer_id<>clean_transfer then
    raise exception 'A different payout transfer is already recorded.';
  end if;

  update public.order_items
  set provider_transfer_id=coalesce(provider_transfer_id,clean_transfer)
  where id=p_order_item_id;

  return true;
end;
$$;

revoke all on function public.recover_order_item_payout_transfer(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.recover_order_item_payout_transfer(uuid,text) to service_role;

create or replace function public.mark_order_item_payout_rollback_required(
  p_order_item_id uuid,
  p_transfer_id text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  item record;
  clean_transfer text:=nullif(btrim(coalesce(p_transfer_id,'')),'');
begin
  if clean_transfer is null then raise exception 'Transfer id is required.'; end if;

  select id,payout_status,funds_released_at,provider_transfer_id
  into item
  from public.order_items
  where id=p_order_item_id
  for update;

  if item.id is null then return false; end if;
  if item.funds_released_at is not null or item.payout_status='released' then return false; end if;
  if item.provider_transfer_id is not null and item.provider_transfer_id<>clean_transfer then
    raise exception 'Rollback transfer does not match the recorded payout transfer.';
  end if;

  update public.order_items
  set
    provider_transfer_id=coalesce(provider_transfer_id,clean_transfer),
    payout_rollback_required=true
  where id=p_order_item_id;

  return true;
end;
$$;

revoke all on function public.mark_order_item_payout_rollback_required(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.mark_order_item_payout_rollback_required(uuid,text) to service_role;

create or replace function public.finalize_order_item_payout_transfer_rollback(
  p_order_item_id uuid,
  p_transfer_id text,
  p_reversal_id text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  item record;
  has_active_case boolean;
  clean_transfer text:=nullif(btrim(coalesce(p_transfer_id,'')),'');
  clean_reversal text:=nullif(btrim(coalesce(p_reversal_id,'')),'');
  next_status text;
begin
  if clean_transfer is null then raise exception 'Transfer id is required.'; end if;
  if clean_reversal is null then raise exception 'Transfer reversal id is required.'; end if;

  select
    oi.id,oi.order_id,oi.payout_status,oi.release_eligible_at,oi.funds_released_at,
    oi.provider_transfer_id,oi.provider_transfer_reversal_id,o.payment_status
  into item
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  where oi.id=p_order_item_id
  for update of oi;

  if item.id is null then return false; end if;
  if item.provider_transfer_id is not null and item.provider_transfer_id<>clean_transfer then
    raise exception 'Rollback transfer does not match the recorded payout transfer.';
  end if;

  select exists(
    select 1
    from public.transaction_cases c
    where c.order_item_id=p_order_item_id
      and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
  ) into has_active_case;

  if item.funds_released_at is not null or item.payout_status='released' then
    update public.order_items
    set
      provider_transfer_id=coalesce(provider_transfer_id,clean_transfer),
      provider_transfer_reversal_id=clean_reversal,
      payout_status='reversed',
      payout_rollback_required=false
    where id=p_order_item_id;
  else
    next_status:=case
      when item.payment_status<>'paid' or has_active_case then 'blocked'
      when item.release_eligible_at is not null then 'scheduled'
      else 'not_ready'
    end;

    update public.order_items
    set
      provider_transfer_id=null,
      provider_transfer_reversal_id=clean_reversal,
      payout_status=next_status,
      payout_rollback_required=false
    where id=p_order_item_id;
  end if;

  if item.provider_transfer_reversal_id is distinct from clean_reversal then
    insert into public.order_events(order_id,order_item_id,event_type,from_status,to_status,metadata)
    values(
      item.order_id,
      p_order_item_id,
      'seller_transfer_rollback_completed',
      item.payout_status,
      case when item.funds_released_at is not null or item.payout_status='released' then 'reversed' else next_status end,
      jsonb_build_object('transfer_id',clean_transfer,'transfer_reversal_id',clean_reversal)
    );
  end if;

  return true;
end;
$$;

revoke all on function public.finalize_order_item_payout_transfer_rollback(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.finalize_order_item_payout_transfer_rollback(uuid,text,text) to service_role;

create or replace function public.abandon_empty_order_item_payout_release_claim(p_order_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  item record;
  has_active_case boolean;
  next_status text;
begin
  select
    oi.id,oi.payout_status,oi.release_eligible_at,oi.funds_released_at,
    oi.provider_transfer_id,o.payment_status
  into item
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  where oi.id=p_order_item_id
  for update of oi;

  if item.id is null then return false; end if;
  if item.payout_status<>'releasing' or item.funds_released_at is not null or item.provider_transfer_id is not null then
    return false;
  end if;

  select exists(
    select 1
    from public.transaction_cases c
    where c.order_item_id=p_order_item_id
      and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
  ) into has_active_case;

  next_status:=case
    when item.payment_status<>'paid' or has_active_case then 'blocked'
    when item.release_eligible_at is not null then 'scheduled'
    else 'not_ready'
  end;

  update public.order_items
  set payout_status=next_status
  where id=p_order_item_id;

  return true;
end;
$$;

revoke all on function public.abandon_empty_order_item_payout_release_claim(uuid) from public,anon,authenticated,service_role;
grant execute on function public.abandon_empty_order_item_payout_release_claim(uuid) to service_role;
