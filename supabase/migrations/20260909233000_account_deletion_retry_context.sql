-- Retry-safe transient cleanup context for the account deletion worker.

alter table public.account_deletion_requests
  add column if not exists target_profile_id uuid,
  add column if not exists cleanup_seller_ids uuid[] not null default '{}'::uuid[],
  add column if not exists cleanup_garage_partner_ids uuid[] not null default '{}'::uuid[];

drop function if exists public.get_account_deletion_processing_queue(integer);
create function public.get_account_deletion_processing_queue(p_limit integer default 50)
returns table(
  request_id uuid,
  profile_id uuid,
  status text,
  requested_at timestamptz,
  blocker_code text
)
language sql
security definer
set search_path=''
as $$
  select
    r.id,
    coalesce(r.profile_id,r.target_profile_id),
    r.status,
    r.requested_at,
    case
      when r.profile_id is null then null
      else private.account_deletion_blocker(r.profile_id)
    end
  from public.account_deletion_requests r
  where r.status in ('requested','processing','blocked','failed')
    and coalesce(r.profile_id,r.target_profile_id) is not null
  order by r.requested_at
  limit greatest(1,least(coalesce(p_limit,50),200));
$$;

revoke all on function public.get_account_deletion_processing_queue(integer) from public;
grant execute on function public.get_account_deletion_processing_queue(integer) to service_role;

create or replace function public.claim_account_deletion_request(p_request_id uuid)
returns table(
  claimed boolean,
  profile_id uuid,
  blocker_code text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  request_row record;
  blocker text;
  seller_ids uuid[];
  garage_ids uuid[];
begin
  select r.id,r.profile_id,r.target_profile_id,r.status
  into request_row
  from public.account_deletion_requests r
  where r.id=p_request_id
  for update;

  if request_row.id is null then
    return query select false,null::uuid,'request_unavailable'::text;
    return;
  end if;

  -- A previous attempt may have already removed Auth/profile. The remaining
  -- operation is only to finish the request audit row.
  if request_row.profile_id is null and request_row.target_profile_id is not null then
    return query select false,request_row.target_profile_id,'identity_already_deleted'::text;
    return;
  end if;

  if request_row.profile_id is null then
    return query select false,null::uuid,'request_unavailable'::text;
    return;
  end if;

  if request_row.status not in ('requested','blocked','failed') then
    return query select false,request_row.profile_id,'request_not_claimable'::text;
    return;
  end if;

  -- Lock seller inventory first. Any concurrent checkout that already locked a
  -- listing finishes before this statement; the fresh blocker check below then
  -- sees that order. New checkouts wait until this transaction completes.
  perform p.id
  from public.parts p
  join public.sellers s on s.id=p.seller_id
  where s.owner_id=request_row.profile_id
  for update of p;

  blocker:=private.account_deletion_blocker(request_row.profile_id);
  if blocker is not null then
    update public.account_deletion_requests
    set
      status='blocked',
      blocker_code=blocker,
      processing_started_at=null,
      last_error=null,
      updated_at=now()
    where id=request_row.id;

    return query select false,request_row.profile_id,blocker;
    return;
  end if;

  select coalesce(array_agg(s.id order by s.id),'{}'::uuid[])
  into seller_ids
  from public.sellers s
  where s.owner_id=request_row.profile_id;

  select coalesce(array_agg(g.id order by g.id),'{}'::uuid[])
  into garage_ids
  from public.garage_partners g
  where g.owner_id=request_row.profile_id;

  -- Freeze public commerce before external storage/Auth work begins.
  update public.parts p
  set status='archived'::public.listing_status
  where p.seller_id=any(seller_ids);

  update public.garage_partners g
  set status='suspended',verified_at=null
  where g.id=any(garage_ids);

  update public.account_deletion_requests
  set
    status='processing',
    blocker_code=null,
    attempt_count=attempt_count+1,
    processing_started_at=now(),
    last_error=null,
    target_profile_id=request_row.profile_id,
    cleanup_seller_ids=seller_ids,
    cleanup_garage_partner_ids=garage_ids,
    updated_at=now()
  where id=request_row.id;

  return query select true,request_row.profile_id,null::text;
end;
$$;

revoke all on function public.claim_account_deletion_request(uuid) from public;
grant execute on function public.claim_account_deletion_request(uuid) to service_role;

create or replace function public.get_account_deletion_part_image_paths(
  p_request_id uuid,
  p_after text default null,
  p_limit integer default 500
)
returns table(storage_path text)
language sql
security definer
set search_path=''
as $$
  select i.storage_path
  from public.account_deletion_requests r
  join public.parts p on p.seller_id=any(r.cleanup_seller_ids)
  join public.part_images i on i.part_id=p.id
  where r.id=p_request_id
    and r.status='processing'
    and (p_after is null or i.storage_path>p_after)
  order by i.storage_path
  limit greatest(1,least(coalesce(p_limit,500),500));
$$;

revoke all on function public.get_account_deletion_part_image_paths(uuid,text,integer) from public;
grant execute on function public.get_account_deletion_part_image_paths(uuid,text,integer) to service_role;

create or replace function public.prepare_claimed_account_deletion(
  p_request_id uuid,
  p_profile_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  request_row record;
  blocker text;
begin
  select r.id,r.profile_id,r.target_profile_id,r.status,r.cleanup_seller_ids,r.cleanup_garage_partner_ids
  into request_row
  from public.account_deletion_requests r
  where r.id=p_request_id
  for update;

  if request_row.id is null
     or request_row.profile_id is distinct from p_profile_id
     or request_row.target_profile_id is distinct from p_profile_id
     or request_row.status<>'processing' then
    raise exception 'Deletion request is not claimed for this profile.';
  end if;

  blocker:=private.account_deletion_blocker(p_profile_id);
  if blocker is not null then
    update public.account_deletion_requests
    set status='blocked',blocker_code=blocker,processing_started_at=null,updated_at=now()
    where id=p_request_id;
    return false;
  end if;

  delete from public.listing_conversations c
  where c.buyer_id=p_profile_id
     or c.seller_id=any(request_row.cleanup_seller_ids);

  delete from public.transaction_reviews
  where reviewer_id=p_profile_id or reviewee_id=p_profile_id;

  -- Storage objects are removed by the worker before this DB cleanup.
  delete from public.part_images i
  where exists(
    select 1 from public.parts p
    where p.id=i.part_id
      and p.seller_id=any(request_row.cleanup_seller_ids)
  );

  delete from public.seller_payment_accounts
  where seller_id=any(request_row.cleanup_seller_ids);

  update public.sellers
  set
    verified_at=null,
    postcode=null,
    latitude=null,
    longitude=null,
    postcode_geocoded_at=null,
    postcode_geocode_approximate=false,
    description='',
    account_deleted_at=now()
  where id=any(request_row.cleanup_seller_ids);

  update public.garage_partners
  set
    status='suspended',
    verified_at=null,
    postcode='Deleted',
    location='Deleted',
    latitude=null,
    longitude=null,
    description='Account deleted. This garage profile is no longer active.'
  where id=any(request_row.cleanup_garage_partner_ids);

  return true;
end;
$$;

revoke all on function public.prepare_claimed_account_deletion(uuid,uuid) from public;
grant execute on function public.prepare_claimed_account_deletion(uuid,uuid) to service_role;

create or replace function public.complete_account_deletion_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.account_deletion_requests
  set
    status='completed',
    profile_id=null,
    target_profile_id=null,
    reason=null,
    blocker_code=null,
    last_error=null,
    processing_started_at=null,
    cleanup_seller_ids='{}'::uuid[],
    cleanup_garage_partner_ids='{}'::uuid[],
    completed_at=now(),
    updated_at=now()
  where id=p_request_id
    and status='processing';

  return found;
end;
$$;

revoke all on function public.complete_account_deletion_request(uuid) from public;
grant execute on function public.complete_account_deletion_request(uuid) to service_role;
