-- Synthetic transaction-only QA: no Auth, profile, seller, Storage or provider deletion.
-- Require abort-on-error execution, e.g. psql -v ON_ERROR_STOP=1 -f this-file.
-- Any SQL error fails the test; the final label alone is never proof.
begin;
select set_config('request.jwt.claims','{}',true);
do $$
declare owner_uuid uuid:=gen_random_uuid(); part_uuid uuid:=gen_random_uuid(); request_uuid uuid:=gen_random_uuid(); test_path text; paths integer;
begin
  if exists(select 1 from auth.users where id=owner_uuid) then raise exception 'Synthetic identity collision'; end if;
  test_path:=owner_uuid::text||'/'||part_uuid::text||'/'||gen_random_uuid()::text||'.png';
  insert into private.part_image_cleanup(storage_path,owner_id,part_id) values(test_path,owner_uuid,part_uuid);
  insert into public.account_deletion_requests(id,profile_id,target_profile_id,status,attempt_count,reason)
  values(request_uuid,null,owner_uuid,'processing',1,'SEC01 synthetic rollback QA');
  select count(*) into paths from public.get_account_deletion_part_image_paths(request_uuid,null,500) where storage_path=test_path;
  if paths<>1 then raise exception 'QA_FAILED: detached identity lost pending path'; end if;
  begin
    perform public.complete_account_deletion_request(request_uuid);
    raise exception 'QA_FAILED: pending cleanup allowed privacy completion';
  exception when others then
    if sqlerrm not like 'Part image cleanup must complete%' then raise; end if;
  end;
  perform public.complete_part_image_cleanup(test_path);
  if not public.complete_account_deletion_request(request_uuid) then raise exception 'QA_FAILED: drained synthetic request did not complete'; end if;
  if exists(select 1 from private.part_image_cleanup where storage_path=test_path) then raise exception 'QA_FAILED: identifying tombstone retained'; end if;
  if not exists(select 1 from public.account_deletion_requests where id=request_uuid and status='completed' and profile_id is null and target_profile_id is null and reason is null) then raise exception 'QA_FAILED: request not anonymized'; end if;
end $$;
rollback;
select 'Detached pending path blocks privacy completion; drained synthetic request anonymizes; all rolled back' as result;
