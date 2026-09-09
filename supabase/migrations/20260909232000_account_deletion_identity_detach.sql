-- Preserve required commerce/audit records while allowing the live user identity
-- to be hard-deleted. Non-transactional profile-linked tables keep their
-- existing cascade behaviour.

alter table public.orders alter column buyer_id drop not null;
alter table public.orders drop constraint if exists orders_buyer_id_fkey;
alter table public.orders
  add constraint orders_buyer_id_fkey
  foreign key(buyer_id) references public.profiles(id) on delete set null;

alter table public.sellers drop constraint if exists sellers_owner_id_fkey;
alter table public.sellers
  add constraint sellers_owner_id_fkey
  foreign key(owner_id) references public.profiles(id) on delete set null;
alter table public.sellers
  add column if not exists account_deleted_at timestamptz;

drop policy if exists "sellers public read" on public.sellers;
create policy "sellers public read"
  on public.sellers for select
  to anon,authenticated
  using (account_deleted_at is null);

drop policy if exists "sellers admin deleted read" on public.sellers;
create policy "sellers admin deleted read"
  on public.sellers for select
  to authenticated
  using (private.is_admin());

alter table public.transaction_cases alter column opened_by drop not null;
alter table public.transaction_cases drop constraint if exists transaction_cases_opened_by_fkey;
alter table public.transaction_cases
  add constraint transaction_cases_opened_by_fkey
  foreign key(opened_by) references public.profiles(id) on delete set null;

alter table public.transaction_messages alter column sender_profile_id drop not null;
alter table public.transaction_messages drop constraint if exists transaction_messages_sender_profile_id_fkey;
alter table public.transaction_messages
  add constraint transaction_messages_sender_profile_id_fkey
  foreign key(sender_profile_id) references public.profiles(id) on delete set null;

alter table public.transaction_case_evidence alter column uploader_profile_id drop not null;
alter table public.transaction_case_evidence drop constraint if exists transaction_case_evidence_uploader_profile_id_fkey;
alter table public.transaction_case_evidence
  add constraint transaction_case_evidence_uploader_profile_id_fkey
  foreign key(uploader_profile_id) references public.profiles(id) on delete set null;

alter table public.garage_partners alter column owner_id drop not null;
alter table public.garage_partners drop constraint if exists garage_partners_owner_id_fkey;
alter table public.garage_partners
  add constraint garage_partners_owner_id_fkey
  foreign key(owner_id) references public.profiles(id) on delete set null;

alter table public.fitting_requests alter column buyer_id drop not null;
alter table public.fitting_requests drop constraint if exists fitting_requests_buyer_id_fkey;
alter table public.fitting_requests
  add constraint fitting_requests_buyer_id_fkey
  foreign key(buyer_id) references public.profiles(id) on delete set null;

alter table public.fitting_request_messages alter column sender_profile_id drop not null;
alter table public.fitting_request_messages drop constraint if exists fitting_request_messages_sender_profile_id_fkey;
alter table public.fitting_request_messages
  add constraint fitting_request_messages_sender_profile_id_fkey
  foreign key(sender_profile_id) references public.profiles(id) on delete set null;

alter table public.seller_prospect_activities alter column actor_profile_id drop not null;
alter table public.seller_prospect_activities drop constraint if exists seller_prospect_activities_actor_profile_id_fkey;
alter table public.seller_prospect_activities
  add constraint seller_prospect_activities_actor_profile_id_fkey
  foreign key(actor_profile_id) references public.profiles(id) on delete set null;

alter table public.seller_prospect_invites alter column created_by drop not null;
alter table public.seller_prospect_invites drop constraint if exists seller_prospect_invites_created_by_fkey;
alter table public.seller_prospect_invites
  add constraint seller_prospect_invites_created_by_fkey
  foreign key(created_by) references public.profiles(id) on delete set null;

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
begin
  select r.id,r.profile_id,r.status
  into request_row
  from public.account_deletion_requests r
  where r.id=p_request_id
  for update;

  if request_row.id is null or request_row.profile_id is null then
    return query select false,null::uuid,'request_unavailable'::text;
    return;
  end if;

  if request_row.status not in ('requested','blocked','failed') then
    return query select false,request_row.profile_id,'request_not_claimable'::text;
    return;
  end if;

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

  update public.account_deletion_requests
  set
    status='processing',
    blocker_code=null,
    attempt_count=attempt_count+1,
    processing_started_at=now(),
    last_error=null,
    updated_at=now()
  where id=request_row.id;

  return query select true,request_row.profile_id,null::text;
end;
$$;

revoke all on function public.claim_account_deletion_request(uuid) from public;
grant execute on function public.claim_account_deletion_request(uuid) to service_role;

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
  select r.id,r.profile_id,r.status
  into request_row
  from public.account_deletion_requests r
  where r.id=p_request_id
  for update;

  if request_row.id is null
     or request_row.profile_id is distinct from p_profile_id
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

  -- Pre-purchase chat is not a retained transaction record.
  delete from public.listing_conversations c
  where c.buyer_id=p_profile_id
     or exists(
       select 1 from public.sellers s
       where s.id=c.seller_id and s.owner_id=p_profile_id
     );

  -- Public reputation is removed with the member identity.
  delete from public.transaction_reviews
  where reviewer_id=p_profile_id or reviewee_id=p_profile_id;

  -- Seller identity is detached but the seller row remains as a transaction
  -- referent for historic order items. All live inventory is unpublished.
  update public.parts p
  set status='archived'::public.listing_status
  where exists(
    select 1 from public.sellers s
    where s.id=p.seller_id and s.owner_id=p_profile_id
  );

  delete from public.seller_payment_accounts spa
  where exists(
    select 1 from public.sellers s
    where s.id=spa.seller_id and s.owner_id=p_profile_id
  );

  update public.sellers
  set
    owner_id=null,
    verified_at=null,
    postcode=null,
    latitude=null,
    longitude=null,
    postcode_geocoded_at=null,
    postcode_geocode_approximate=false,
    description='',
    account_deleted_at=now()
  where owner_id=p_profile_id;

  update public.garage_partners
  set
    owner_id=null,
    status='suspended',
    verified_at=null,
    postcode='Deleted',
    location='Deleted',
    latitude=null,
    longitude=null,
    description='Account deleted. This garage profile is no longer active.'
  where owner_id=p_profile_id;

  return true;
end;
$$;

revoke all on function public.prepare_claimed_account_deletion(uuid,uuid) from public;
grant execute on function public.prepare_claimed_account_deletion(uuid,uuid) to service_role;

create or replace function public.fail_account_deletion_request(p_request_id uuid,p_error text)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.account_deletion_requests
  set
    status='failed',
    last_error=left(coalesce(p_error,'processing_failed'),500),
    processing_started_at=null,
    updated_at=now()
  where id=p_request_id
    and status='processing';
  return found;
end;
$$;

revoke all on function public.fail_account_deletion_request(uuid,text) from public;
grant execute on function public.fail_account_deletion_request(uuid,text) to service_role;

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
    reason=null,
    blocker_code=null,
    last_error=null,
    processing_started_at=null,
    completed_at=now(),
    updated_at=now()
  where id=p_request_id
    and status='processing';

  return found;
end;
$$;

revoke all on function public.complete_account_deletion_request(uuid) from public;
grant execute on function public.complete_account_deletion_request(uuid) to service_role;
