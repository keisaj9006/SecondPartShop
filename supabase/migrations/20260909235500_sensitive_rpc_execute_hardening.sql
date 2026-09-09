-- Least-privilege execution grants for deletion and payout-review SECURITY DEFINER RPCs.
-- Function-level authorization is enforced even if an application route is misconfigured.

revoke all on function public.claim_account_deletion_request(uuid) from public,anon,authenticated,service_role;
revoke all on function public.prepare_claimed_account_deletion(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.fail_account_deletion_request(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.complete_account_deletion_request(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_account_deletion_processing_queue(integer) from public,anon,authenticated,service_role;
revoke all on function public.get_account_deletion_part_image_paths(uuid,text,integer) from public,anon,authenticated,service_role;

grant execute on function public.claim_account_deletion_request(uuid) to service_role;
grant execute on function public.prepare_claimed_account_deletion(uuid,uuid) to service_role;
grant execute on function public.fail_account_deletion_request(uuid,text) to service_role;
grant execute on function public.complete_account_deletion_request(uuid) to service_role;
grant execute on function public.get_account_deletion_processing_queue(integer) to service_role;
grant execute on function public.get_account_deletion_part_image_paths(uuid,text,integer) to service_role;

revoke all on function public.cancel_own_account_deletion_request() from public,anon,authenticated,service_role;
grant execute on function public.cancel_own_account_deletion_request() to authenticated,service_role;

revoke all on function public.admin_start_unverified_delivery_release_window(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_unverified_delivery_payout_reviews(integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_start_unverified_delivery_release_window(uuid) to authenticated,service_role;
grant execute on function public.get_unverified_delivery_payout_reviews(integer) to authenticated,service_role;
