-- Internal queue workers are called by owner-executed triggers/cron, never
-- directly by marketplace clients. Preserve service-role operations.
-- No function bodies, RLS policies, data or historical ledger entries change.
begin;

revoke execute on function private.enqueue_part_request_refresh_for_part_signals(uuid[],text[],uuid[])
  from public,anon,authenticated;
revoke execute on function private.process_part_request_refresh_queue(integer)
  from public,anon,authenticated;
revoke execute on function private.refresh_seller_part_request_matches(uuid)
  from public,anon,authenticated;

grant execute on function private.enqueue_part_request_refresh_for_part_signals(uuid[],text[],uuid[])
  to service_role;
grant execute on function private.process_part_request_refresh_queue(integer)
  to service_role;
grant execute on function private.refresh_seller_part_request_matches(uuid)
  to service_role;

commit;
