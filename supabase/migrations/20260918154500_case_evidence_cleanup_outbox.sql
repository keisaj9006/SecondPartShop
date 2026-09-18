begin;

create table private.case_evidence_cleanup (
  storage_path text primary key,
  case_id uuid not null,
  uploader_id uuid not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  failure_count integer not null default 0,
  last_error text check (last_error is null or last_error='storage_cleanup_failed')
);

-- No foreign keys: a pending Storage deletion must survive later case/profile
-- cleanup and remain auditable until the bytes are retired.
alter table private.case_evidence_cleanup enable row level security;
revoke all on private.case_evidence_cleanup from public,anon,authenticated,service_role;

create index case_evidence_cleanup_pending
  on private.case_evidence_cleanup(next_attempt_at,created_at)
  where completed_at is null;

create or replace function public.queue_orphan_case_evidence_cleanup(
  p_case_id uuid,
  p_uploader_id uuid,
  p_storage_path text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  participant record;
begin
  select c.id,o.buyer_id,s.owner_id
  into participant
  from public.transaction_cases c
  join public.order_items oi on oi.id=c.order_item_id
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  where c.id=p_case_id;

  if participant.id is null
     or (participant.buyer_id is distinct from p_uploader_id
         and participant.owner_id is distinct from p_uploader_id) then
    raise exception 'Case evidence cleanup participant unavailable.';
  end if;

  if p_storage_path !~ (
    '^'||p_case_id::text||'/'||p_uploader_id::text||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
  ) then
    raise exception 'Invalid orphan case evidence path.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_storage_path,739));

  -- Registration may have succeeded in a concurrent/retried request. An
  -- attached evidence path is never Storage-delete authority.
  if exists(
    select 1 from public.transaction_case_evidence e
    where e.storage_path=p_storage_path
  ) then
    return false;
  end if;

  insert into private.case_evidence_cleanup(storage_path,case_id,uploader_id)
  values(p_storage_path,p_case_id,p_uploader_id)
  on conflict(storage_path) do nothing;

  return true;
end;
$$;

revoke all on function public.queue_orphan_case_evidence_cleanup(uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.queue_orphan_case_evidence_cleanup(uuid,uuid,text)
  to service_role;

create or replace function public.get_case_evidence_cleanup_queue(
  p_limit integer default 50,
  p_storage_path text default null
)
returns table(storage_path text)
language sql
security definer
set search_path=''
as $$
  select q.storage_path
  from private.case_evidence_cleanup q
  where q.completed_at is null
    and (p_storage_path is null or q.storage_path=p_storage_path)
    and (p_storage_path is not null or q.next_attempt_at<=now())
    and not exists(
      select 1 from public.transaction_case_evidence e
      where e.storage_path=q.storage_path
    )
  order by q.next_attempt_at,q.created_at,q.storage_path
  limit greatest(1,least(coalesce(p_limit,50),100));
$$;

revoke all on function public.get_case_evidence_cleanup_queue(integer,text)
  from public,anon,authenticated,service_role;
grant execute on function public.get_case_evidence_cleanup_queue(integer,text)
  to service_role;

create or replace function public.complete_case_evidence_cleanup(p_storage_path text)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  update private.case_evidence_cleanup
  set completed_at=coalesce(completed_at,now()),last_error=null
  where storage_path=p_storage_path
    and not exists(
      select 1 from public.transaction_case_evidence e
      where e.storage_path=p_storage_path
    );
  return found;
end;
$$;

revoke all on function public.complete_case_evidence_cleanup(text)
  from public,anon,authenticated,service_role;
grant execute on function public.complete_case_evidence_cleanup(text)
  to service_role;

create or replace function public.fail_case_evidence_cleanup(p_storage_path text)
returns void
language sql
security definer
set search_path=''
as $$
  update private.case_evidence_cleanup
  set
    failure_count=least(failure_count+1,1000000),
    last_error='storage_cleanup_failed',
    next_attempt_at=now()+interval '5 minutes'
  where storage_path=p_storage_path
    and completed_at is null;
$$;

revoke all on function public.fail_case_evidence_cleanup(text)
  from public,anon,authenticated,service_role;
grant execute on function public.fail_case_evidence_cleanup(text)
  to service_role;

commit;
