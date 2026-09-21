begin;

-- Cleanup intent permanently retires a generated object path. Registration
-- and queueing must share the same lock: a worker may delete bytes after its
-- queue read, so a second existence check alone cannot protect late inserts.
create or replace function private.guard_case_evidence_cleanup_registration()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.storage_path,739));
  if exists (
    select 1 from private.case_evidence_cleanup q
    where q.storage_path=new.storage_path
  ) then
    raise exception 'Evidence path is retired for cleanup; upload a new file.';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_case_evidence_cleanup_registration()
  from public,anon,authenticated,service_role;

create trigger case_evidence_cleanup_registration_guard
before insert or update of storage_path on public.transaction_case_evidence
for each row execute function private.guard_case_evidence_cleanup_registration();

commit;
