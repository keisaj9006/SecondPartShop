-- Account-deletion processing foundation.
-- This migration hardens the user-facing request queue and adds a service-only
-- preflight signal. It intentionally does not yet perform destructive
-- anonymisation; that is handled by the processor after the retention schema
-- has been transformed safely.

alter table public.account_deletion_requests
  add column if not exists blocker_code text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists processing_started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists last_error text;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_status_check;
alter table public.account_deletion_requests
  add constraint account_deletion_requests_status_check
  check (status in ('requested','processing','blocked','failed','cancelled','completed'));

alter table public.account_deletion_requests
  alter column profile_id drop not null;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_profile_id_fkey;
alter table public.account_deletion_requests
  add constraint account_deletion_requests_profile_id_fkey
  foreign key(profile_id) references public.profiles(id) on delete set null;

drop index if exists public.account_deletion_requests_open_unique;
create unique index account_deletion_requests_open_unique
  on public.account_deletion_requests(profile_id)
  where profile_id is not null
    and status in ('requested','processing','blocked','failed');

-- A client may create only a real requested record, never forge processor states.
drop policy if exists "account deletion own insert" on public.account_deletion_requests;
create policy "account deletion own insert"
  on public.account_deletion_requests for insert
  to authenticated
  with check (
    (select auth.uid())=profile_id
    and status='requested'
    and blocker_code is null
    and processing_started_at is null
    and completed_at is null
  );

-- Users should cancel through the controlled RPC below, not freely edit
-- processing/completion fields.
drop policy if exists "account deletion own update" on public.account_deletion_requests;
revoke update on public.account_deletion_requests from authenticated;
grant select,insert on public.account_deletion_requests to authenticated;

create or replace function public.cancel_own_account_deletion_request()
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
begin
  if actor is null then raise exception 'Authentication required.'; end if;

  update public.account_deletion_requests
  set
    status='cancelled',
    blocker_code=null,
    last_error=null,
    updated_at=now()
  where profile_id=actor
    and status in ('requested','blocked','failed')
    and processing_started_at is null;

  return found;
end;
$$;

revoke all on function public.cancel_own_account_deletion_request() from public;
grant execute on function public.cancel_own_account_deletion_request() to authenticated;

create or replace function private.account_deletion_blocker(p_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  seller_ids uuid[];
begin
  if p_profile_id is null then return 'profile_missing'; end if;

  select coalesce(array_agg(s.id),'{}'::uuid[])
  into seller_ids
  from public.sellers s
  where s.owner_id=p_profile_id;

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

create or replace function public.get_account_deletion_processing_queue(p_limit integer default 50)
returns table(
  request_id uuid,
  profile_id uuid,
  requested_at timestamptz,
  blocker_code text
)
language sql
security definer
set search_path=''
as $$
  select
    r.id,
    r.profile_id,
    r.requested_at,
    private.account_deletion_blocker(r.profile_id)
  from public.account_deletion_requests r
  where r.status in ('requested','blocked','failed')
    and r.profile_id is not null
  order by r.requested_at
  limit greatest(1,least(coalesce(p_limit,50),200));
$$;

revoke all on function public.get_account_deletion_processing_queue(integer) from public;
grant execute on function public.get_account_deletion_processing_queue(integer) to service_role;
