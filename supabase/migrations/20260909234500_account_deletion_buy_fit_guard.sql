-- Prevent account deletion from orphaning an active Buy + Fit workflow.

create or replace function private.account_deletion_blocker(p_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  seller_ids uuid[];
  garage_ids uuid[];
begin
  if p_profile_id is null then return 'profile_missing'; end if;

  select coalesce(array_agg(s.id),'{}'::uuid[])
  into seller_ids
  from public.sellers s
  where s.owner_id=p_profile_id;

  select coalesce(array_agg(g.id),'{}'::uuid[])
  into garage_ids
  from public.garage_partners g
  where g.owner_id=p_profile_id;

  if exists(
    select 1
    from public.orders o
    where o.buyer_id=p_profile_id
      and (
        o.payment_status in ('unpaid','requires_action','processing','disputed','partially_refunded')
        or o.status not in ('completed','cancelled','refunded')
      )
  ) then
    return 'buyer_commerce_active';
  end if;

  if exists(
    select 1
    from public.order_items oi
    join public.orders o on o.id=oi.order_id
    where oi.seller_id=any(seller_ids)
      and (
        oi.fulfilment_status not in ('completed','cancelled','refunded')
        or oi.payout_status in ('scheduled','releasing')
        or oi.payout_rollback_required
        or o.payment_status in ('processing','disputed')
      )
  ) then
    return 'seller_commerce_active';
  end if;

  if exists(
    select 1
    from public.transaction_cases c
    join public.order_items oi on oi.id=c.order_item_id
    join public.orders o on o.id=oi.order_id
    where c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
      and (
        o.buyer_id=p_profile_id
        or oi.seller_id=any(seller_ids)
      )
  ) then
    return 'transaction_case_active';
  end if;

  if exists(
    select 1
    from public.fitting_requests f
    where f.status in ('requested','quoted','accepted')
      and (
        f.buyer_id=p_profile_id
        or f.garage_partner_id=any(garage_ids)
      )
  ) then
    return 'fitting_request_active';
  end if;

  if exists(
    select 1
    from public.marketplace_reports r
    where r.status='open'
      and (
        r.reporter_id=p_profile_id
        or r.reported_profile_id=p_profile_id
        or r.seller_id=any(seller_ids)
      )
  ) then
    return 'moderation_case_active';
  end if;

  return null;
end;
$$;

revoke all on function private.account_deletion_blocker(uuid) from public;
