-- DISPOSABLE DATABASE QA ONLY. DML-only, always ROLLBACK; no Storage operations.
-- Run with psql -v ON_ERROR_STOP=1 -v qa_owner_id=... -v qa_part_id=... -f this-file
-- Preconditions: a disposable seller's DRAFT listing titled SEC01-QA-...
-- or [QA TEST] Photo integrity fixture,
-- with no order items. Never point this at a real member's listing.
-- The script verifies trigger/role behavior. It cannot prove HTTP Storage policy
-- enforcement or concurrent sessions; see docs/part-image-cleanup-runbook.md.
begin;
select set_config('qa.owner_id',:'qa_owner_id',true);
select set_config('qa.part_id',:'qa_part_id',true);
select set_config('qa.seller_id',(select seller_id::text from public.parts where id=:'qa_part_id'::uuid),true);
select set_config('request.jwt.claims','{}',true);
do $$
begin
  if not exists(select 1 from public.parts p join public.sellers s on s.id=p.seller_id
    where p.id=current_setting('qa.part_id')::uuid and s.owner_id=current_setting('qa.owner_id')::uuid
      and p.status='draft' and (p.title like 'SEC01-QA-%' or p.title='[QA TEST] Photo integrity fixture')
      and not exists(select 1 from public.order_items i where i.part_id=p.id)) then
    raise exception 'Disposable draft fixture precondition failed.';
  end if;
end;
$$;
select set_config('qa.image1',gen_random_uuid()::text,true);
select set_config('qa.image2',gen_random_uuid()::text,true);
select set_config('qa.path1',current_setting('qa.owner_id')||'/'||current_setting('qa.part_id')||'/'||gen_random_uuid()::text||'.jpg',true);
select set_config('qa.path2',current_setting('qa.owner_id')||'/'||current_setting('qa.part_id')||'/'||gen_random_uuid()::text||'.jpg',true);
select set_config('qa.path3',current_setting('qa.owner_id')||'/'||current_setting('qa.part_id')||'/'||gen_random_uuid()::text||'.jpg',true);
delete from public.part_images where part_id=current_setting('qa.part_id')::uuid;
insert into public.part_images(id,part_id,storage_path,alt_text,position) values
  (current_setting('qa.image1')::uuid,current_setting('qa.part_id')::uuid,current_setting('qa.path1'),'Disposable QA 1',0),
  (current_setting('qa.image2')::uuid,current_setting('qa.part_id')::uuid,current_setting('qa.path2'),'Disposable QA 2',1);
update public.parts set status='active' where id=current_setting('qa.part_id')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.owner_id'),'role','authenticated')::text,true);
set local role authenticated;
delete from public.part_images where id=current_setting('qa.image1')::uuid;
do $$
begin
  begin
    delete from public.part_images where id=current_setting('qa.image2')::uuid;
    raise exception 'QA_FAILED: final photo deletion accepted';
  exception when others then
    if sqlerrm not like 'An active listing must keep%' then raise; end if;
  end;
  begin
    insert into public.part_images(part_id,storage_path,alt_text) values(current_setting('qa.part_id')::uuid,current_setting('qa.path1'),'Retired QA');
    raise exception 'QA_FAILED: retired path accepted';
  exception when others then
    if sqlerrm not like 'This photo path is retired%' then raise; end if;
  end;
  begin
    update public.part_images set storage_path=current_setting('qa.path3') where id=current_setting('qa.image2')::uuid;
    raise exception 'QA_FAILED: storage path mutation accepted';
  exception when others then
    if sqlerrm not like 'Photo part and storage path are immutable%' then raise; end if;
  end;
end;
$$;
reset role;
select set_config('request.jwt.claims','{}',true);
do $$
begin
  if not exists(select 1 from private.part_image_cleanup where storage_path=current_setting('qa.path1')
    and owner_id=current_setting('qa.owner_id')::uuid and part_id=current_setting('qa.part_id')::uuid and completed_at is null) then
    raise exception 'QA_FAILED: exact owned cleanup intent missing';
  end if;
  if public.queue_orphan_part_image_cleanup(current_setting('qa.owner_id')::uuid,current_setting('qa.part_id')::uuid,current_setting('qa.path2')) then
    raise exception 'QA_FAILED: attached object queued as orphan';
  end if;
  begin
    perform public.queue_orphan_part_image_cleanup(gen_random_uuid(),current_setting('qa.part_id')::uuid,current_setting('qa.path3'));
    raise exception 'QA_FAILED: wrong owner queued orphan';
  exception when others then
    if sqlerrm not like 'Photo cleanup owner or listing unavailable%' then raise; end if;
  end;
  perform public.queue_orphan_part_image_cleanup(current_setting('qa.owner_id')::uuid,current_setting('qa.part_id')::uuid,current_setting('qa.path3'));
  -- No bytes exist at the generated QA path; this tests only tombstone behavior.
  perform public.complete_part_image_cleanup(current_setting('qa.path3'));
end;
$$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.owner_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$
begin
  if private.can_upload_part_image(current_setting('qa.path3')) then raise exception 'QA_FAILED: completed path upload accepted'; end if;
  begin
    insert into public.part_images(part_id,storage_path,alt_text) values(current_setting('qa.part_id')::uuid,current_setting('qa.path3'),'Completed QA');
    raise exception 'QA_FAILED: completed path reattached';
  exception when others then
    if sqlerrm not like 'This photo path is retired%' then raise; end if;
  end;
  if has_function_privilege('authenticated','public.queue_orphan_part_image_cleanup(uuid,uuid,text)','execute') then
    raise exception 'QA_FAILED: client has orphan queue authority';
  end if;
end;
$$;
reset role;
select set_config('request.jwt.claims','{}',true);
update public.parts set status='reserved' where id=current_setting('qa.part_id')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.owner_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare affected integer;
begin
  delete from public.part_images where id=current_setting('qa.image2')::uuid;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'QA_FAILED: reserved direct deletion accepted'; end if;
  delete from public.parts where id=current_setting('qa.part_id')::uuid;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'QA_FAILED: reserved parent deletion accepted'; end if;
end;
$$;
reset role;
do $$
begin
  if exists(select 1 from private.part_image_cleanup where storage_path=current_setting('qa.path2')) then
    raise exception 'QA_FAILED: reserved deletion queued cleanup';
  end if;
end;
$$;
select set_config('request.jwt.claims','{}',true);
update public.parts set status='active' where id=current_setting('qa.part_id')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.owner_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare affected integer;
begin
  -- Removing the entire authorized non-reserved listing is permitted even when
  -- its final photo could not be removed while keeping the listing active.
  delete from public.parts where id=current_setting('qa.part_id')::uuid;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'QA_FAILED: authorized parent deletion did not remove listing'; end if;
end;
$$;
reset role;
do $$
begin
  if exists(select 1 from public.part_images where part_id=current_setting('qa.part_id')::uuid) then
    raise exception 'QA_FAILED: authorized parent deletion did not cascade photos';
  end if;
  if not exists(select 1 from private.part_image_cleanup q where q.storage_path=current_setting('qa.path2')
    and q.owner_id=current_setting('qa.owner_id')::uuid and q.seller_id=current_setting('qa.seller_id')::uuid
    and q.part_id=current_setting('qa.part_id')::uuid and q.completed_at is null) then
    raise exception 'QA_FAILED: parent cascade lost exact owner/seller cleanup context';
  end if;
end;
$$;
rollback;
