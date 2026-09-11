-- SEC-01: deploy the readiness-gated application first, then apply atomically.
-- Storage bytes are removed only by the service worker, never by SQL.
begin;

create table private.part_image_cleanup (
  storage_path text primary key,
  owner_id uuid not null,
  seller_id uuid,
  part_id uuid not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  failure_count integer not null default 0,
  last_error text check (last_error is null or last_error='storage_cleanup_failed')
);
-- No FKs: identity/part cascades must never erase pending deletion evidence.
alter table private.part_image_cleanup enable row level security;
revoke all on private.part_image_cleanup from public,anon,authenticated,service_role;
create index part_image_cleanup_pending on private.part_image_cleanup(next_attempt_at)
where completed_at is null;
create index part_image_cleanup_owner on private.part_image_cleanup(owner_id);

-- Existing paths must satisfy the same ownership assumptions as new uploads.
-- Stop for a reviewed legacy-data repair rather than authorize another owner's bytes.
do $$
begin
  if exists (
    select 1 from public.part_images i
    join public.parts p on p.id=i.part_id
    join public.sellers s on s.id=p.seller_id
    where s.owner_id is not null
      and i.storage_path not like s.owner_id::text||'/'||p.id::text||'/%'
  ) then
    raise exception 'Part image ownership preflight failed; inspect legacy paths before applying SEC-01.';
  end if;
end;
$$;

create or replace function private.guard_part_image_attachment()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  part_row record;
begin
  if tg_op='UPDATE' and (new.part_id is distinct from old.part_id or new.storage_path is distinct from old.storage_path) then
    raise exception 'Photo part and storage path are immutable.';
  end if;
  -- Common ordering: parent first, exact-path advisory lock second.
  select p.id,p.status,p.seller_id,s.owner_id into part_row
  from public.parts p join public.sellers s on s.id=p.seller_id
  where p.id=new.part_id for update of p;
  if part_row.id is null then raise exception 'Listing not found.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.storage_path,731));
  if auth.uid() is not null and not private.is_admin() then
    if part_row.owner_id is distinct from auth.uid() then raise exception 'Photo ownership mismatch.'; end if;
    if part_row.status='reserved' then raise exception 'This listing is temporarily reserved in an active checkout.'; end if;
    if exists(select 1 from public.account_deletion_requests r where r.target_profile_id=auth.uid() and r.attempt_count>0 and r.status in ('processing','failed','blocked')) then
      raise exception 'Account deletion is in progress.';
    end if;
    if new.storage_path !~ ('^'||part_row.owner_id::text||'/'||new.part_id::text||'/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then
      raise exception 'Photo path must belong to the listing owner and exact listing.';
    end if;
  end if;
  if exists(select 1 from private.part_image_cleanup q where q.storage_path=new.storage_path) then
    raise exception 'This photo path is retired; upload a new photo.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_part_image_attachment() from public,anon,authenticated,service_role;
create trigger part_images_guard_attachment before insert or update on public.part_images
for each row execute function private.guard_part_image_attachment();

-- DELETE already holds the parent row lock. Capture the authorized parent's
-- owner/seller while it is still visible, before the FK cascade removes photos.
create function private.queue_part_images_before_parent_delete()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  parent_owner uuid;
  path_owner uuid;
  image_row record;
begin
  select s.owner_id into parent_owner from public.sellers s where s.id=old.seller_id;
  if auth.uid() is not null and not private.is_admin() then
    if parent_owner is distinct from auth.uid() then raise exception 'Listing photo ownership mismatch.'; end if;
    if old.status='reserved' then raise exception 'This listing is temporarily reserved in an active checkout.'; end if;
  end if;
  for image_row in select i.storage_path from public.part_images i where i.part_id=old.id order by i.storage_path loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(image_row.storage_path,731));
    path_owner:=coalesce(parent_owner,split_part(image_row.storage_path,'/',1)::uuid);
    if split_part(image_row.storage_path,'/',1)<>path_owner::text or split_part(image_row.storage_path,'/',2)<>old.id::text then
      raise exception 'Photo cleanup ownership mismatch; legacy data requires review.';
    end if;
    insert into private.part_image_cleanup(storage_path,owner_id,seller_id,part_id)
    values(image_row.storage_path,path_owner,old.seller_id,old.id)
    on conflict(storage_path) do nothing;
  end loop;
  return old;
end;
$$;
revoke all on function private.queue_part_images_before_parent_delete() from public,anon,authenticated,service_role;
create trigger parts_queue_images_before_delete before delete on public.parts
for each row execute function private.queue_part_images_before_parent_delete();

create or replace function private.prevent_last_active_listing_image_delete()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  part_row record;
  path_owner uuid;
  cleanup_owner uuid;
begin
  select p.id,p.status,p.seller_id,s.owner_id into part_row
  from public.parts p join public.sellers s on s.id=p.seller_id
  where p.id=old.part_id for update of p;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.storage_path,731));
  if part_row.id is null then
    -- Only the authorized parent trigger can queue an attached photo. Orphan
    -- queueing rejects attached paths, and clients cannot write the outbox.
    select q.owner_id into cleanup_owner from private.part_image_cleanup q
    where q.storage_path=old.storage_path and q.part_id=old.part_id and q.completed_at is null;
    if cleanup_owner is null then raise exception 'Missing authorized parent photo cleanup context.'; end if;
    if auth.uid() is not null and not private.is_admin() and cleanup_owner is distinct from auth.uid() then
      raise exception 'Photo ownership mismatch.';
    end if;
    return old;
  end if;
  if auth.uid() is not null and not private.is_admin() then
    if part_row.owner_id is distinct from auth.uid() then raise exception 'Photo ownership mismatch.'; end if;
    if part_row.status='reserved' then raise exception 'This listing is temporarily reserved in an active checkout.'; end if;
    if part_row.status='active' and (select count(*) from public.part_images i where i.part_id=old.part_id)<=1 then
      raise exception 'An active listing must keep at least one real product photo.';
    end if;
  end if;
  -- Service privacy cleanup may still see a retained, detached seller row.
  path_owner:=coalesce(part_row.owner_id,split_part(old.storage_path,'/',1)::uuid);
  if split_part(old.storage_path,'/',1)<>path_owner::text or split_part(old.storage_path,'/',2)<>old.part_id::text then
    raise exception 'Photo cleanup ownership mismatch; legacy data requires review.';
  end if;
  insert into private.part_image_cleanup(storage_path,owner_id,seller_id,part_id)
  values(old.storage_path,path_owner,part_row.seller_id,old.part_id)
  on conflict(storage_path) do nothing;
  return old;
end;
$$;
revoke all on function private.prevent_last_active_listing_image_delete() from public,anon,authenticated,service_role;

-- Called only by the server with its own generated upload path. The parent lock
-- also serializes this check with direct authenticated metadata attachment.
create function public.queue_orphan_part_image_cleanup(p_owner_id uuid,p_part_id uuid,p_storage_path text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare part_row record;
begin
  select p.id,p.seller_id,s.owner_id into part_row
  from public.parts p join public.sellers s on s.id=p.seller_id
  where p.id=p_part_id for update of p;
  if part_row.id is null or part_row.owner_id is distinct from p_owner_id then
    raise exception 'Photo cleanup owner or listing unavailable.';
  end if;
  if p_storage_path !~ ('^'||p_owner_id::text||'/'||p_part_id::text||'/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then
    raise exception 'Invalid orphan photo path.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_storage_path,731));
  if exists(select 1 from public.part_images i where i.storage_path=p_storage_path) then return false; end if;
  insert into private.part_image_cleanup(storage_path,owner_id,seller_id,part_id)
  values(p_storage_path,p_owner_id,part_row.seller_id,p_part_id)
  on conflict(storage_path) do nothing;
  return true;
end;
$$;
revoke all on function public.queue_orphan_part_image_cleanup(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.queue_orphan_part_image_cleanup(uuid,uuid,text) to service_role;

create function public.get_part_image_cleanup_queue(p_limit integer default 50,p_storage_path text default null)
returns table(storage_path text) language sql security definer set search_path=''
as $$
  select q.storage_path from private.part_image_cleanup q
  where q.completed_at is null
    and (p_storage_path is null or q.storage_path=p_storage_path)
    and (p_storage_path is not null or q.next_attempt_at<=now())
    and not exists(select 1 from public.part_images i where i.storage_path=q.storage_path)
  order by q.next_attempt_at,q.created_at,q.storage_path
  limit greatest(1,least(coalesce(p_limit,50),100));
$$;
revoke all on function public.get_part_image_cleanup_queue(integer,text) from public,anon,authenticated,service_role;
grant execute on function public.get_part_image_cleanup_queue(integer,text) to service_role;

create function public.complete_part_image_cleanup(p_storage_path text)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  update private.part_image_cleanup set completed_at=coalesce(completed_at,now()),last_error=null
  where storage_path=p_storage_path
    and not exists(select 1 from public.part_images i where i.storage_path=p_storage_path);
  return found;
end;
$$;
revoke all on function public.complete_part_image_cleanup(text) from public,anon,authenticated,service_role;
grant execute on function public.complete_part_image_cleanup(text) to service_role;

create function public.fail_part_image_cleanup(p_storage_path text)
returns void language sql security definer set search_path=''
as $$
  update private.part_image_cleanup
  set failure_count=least(failure_count+1,1000000),last_error='storage_cleanup_failed',next_attempt_at=now()+interval '5 minutes'
  where storage_path=p_storage_path and completed_at is null;
$$;
revoke all on function public.fail_part_image_cleanup(text) from public,anon,authenticated,service_role;
grant execute on function public.fail_part_image_cleanup(text) to service_role;

-- Preserve unique non-upsert upload/read capability, but stop retirement races.
create function private.can_upload_part_image(p_path text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare part_row record; part_uuid uuid;
begin
  if auth.uid() is null or p_path !~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then return false; end if;
  begin part_uuid:=split_part(p_path,'/',2)::uuid; exception when invalid_text_representation then return false; end;
  select p.id,p.status,s.owner_id into part_row from public.parts p join public.sellers s on s.id=p.seller_id
  where p.id=part_uuid for update of p;
  if part_row.id is null or part_row.owner_id is distinct from auth.uid() or part_row.status='reserved' then return false; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('seller','admin')) then return false; end if;
  if exists(select 1 from public.account_deletion_requests r where r.target_profile_id=auth.uid() and r.attempt_count>0 and r.status in ('processing','failed','blocked')) then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_path,731));
  return not exists(select 1 from private.part_image_cleanup q where q.storage_path=p_path);
end;
$$;
revoke all on function private.can_upload_part_image(text) from public,anon,authenticated,service_role;
grant execute on function private.can_upload_part_image(text) to authenticated;
drop policy if exists "part images seller upload" on storage.objects;
create policy "part images seller upload" on storage.objects for insert to authenticated
with check(bucket_id='part-images' and private.can_upload_part_image(name));
drop policy if exists "part images seller delete" on storage.objects;
drop policy if exists "part images seller update" on storage.objects;
-- Restrictive policies prevent an unrelated permissive policy from reopening
-- part-images DELETE/UPDATE. Service-role Storage authority still bypasses RLS.
create policy "part images deny client delete" on storage.objects as restrictive for delete to authenticated
using(bucket_id<>'part-images');
create policy "part images deny client update" on storage.objects as restrictive for update to authenticated
using(bucket_id<>'part-images') with check(bucket_id<>'part-images');
create policy "part images validate client upload" on storage.objects as restrictive for insert to authenticated
with check(bucket_id<>'part-images' or private.can_upload_part_image(name));

create or replace function public.get_account_deletion_part_image_paths(p_request_id uuid,p_after text default null,p_limit integer default 500)
returns table(storage_path text) language sql security definer set search_path=''
as $$
  select paths.storage_path from public.account_deletion_requests r
  cross join lateral (
    select i.storage_path from public.parts p join public.part_images i on i.part_id=p.id
    where p.seller_id=any(r.cleanup_seller_ids)
    union
    select q.storage_path from private.part_image_cleanup q
    where q.completed_at is null
      and (q.owner_id=coalesce(r.profile_id,r.target_profile_id) or q.seller_id=any(r.cleanup_seller_ids))
  ) paths
  where r.id=p_request_id and r.status='processing'
    and (p_after is null or paths.storage_path>p_after)
  order by paths.storage_path limit greatest(1,least(coalesce(p_limit,500),500));
$$;
revoke all on function public.get_account_deletion_part_image_paths(uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_account_deletion_part_image_paths(uuid,text,integer) to service_role;

create or replace function public.complete_account_deletion_request(p_request_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare request_row record;
begin
  select r.* into request_row from public.account_deletion_requests r where r.id=p_request_id for update;
  if request_row.id is null or request_row.status<>'processing' or coalesce(request_row.profile_id,request_row.target_profile_id) is null then return false; end if;
  -- Lock surviving parents before the final pending-work check. New orphan work
  -- requires a live matching seller owner, absent after safe identity deletion.
  perform p.id from public.parts p where p.seller_id=any(request_row.cleanup_seller_ids) order by p.id for update;
  if exists(select 1 from auth.users u where u.id=coalesce(request_row.profile_id,request_row.target_profile_id)) then
    raise exception 'Auth identity must be deleted before privacy finalization.';
  end if;
  if exists(select 1 from public.part_images i join public.parts p on p.id=i.part_id where p.seller_id=any(request_row.cleanup_seller_ids))
     or exists(select 1 from private.part_image_cleanup q where q.completed_at is null and (q.owner_id=coalesce(request_row.profile_id,request_row.target_profile_id) or q.seller_id=any(request_row.cleanup_seller_ids))) then
    raise exception 'Part image cleanup must complete before privacy finalization.';
  end if;
  -- Read-only verification of the privacy worker's owner-prefix Storage scan.
  -- Bytes still must be removed using the Storage API, never SQL DML.
  if exists(select 1 from storage.objects o where o.bucket_id='part-images'
    and split_part(o.name,'/',1)=coalesce(request_row.profile_id,request_row.target_profile_id)::text) then
    raise exception 'Owner-prefix Storage cleanup must complete before privacy finalization.';
  end if;
  delete from private.part_image_cleanup q
  where q.completed_at is not null and (q.owner_id=coalesce(request_row.profile_id,request_row.target_profile_id) or q.seller_id=any(request_row.cleanup_seller_ids));
  update public.account_deletion_requests set status='completed',profile_id=null,target_profile_id=null,reason=null,
    blocker_code=null,last_error=null,processing_started_at=null,cleanup_seller_ids='{}'::uuid[],cleanup_garage_partner_ids='{}'::uuid[],
    completed_at=now(),updated_at=now() where id=p_request_id;
  return true;
end;
$$;
revoke all on function public.complete_account_deletion_request(uuid) from public,anon,authenticated,service_role;
grant execute on function public.complete_account_deletion_request(uuid) to service_role;

commit;
