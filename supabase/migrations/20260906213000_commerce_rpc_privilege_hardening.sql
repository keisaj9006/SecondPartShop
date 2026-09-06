-- Commerce RPC privilege hardening.
-- Public reputation/readiness RPCs intentionally remain callable as designed.

-- Service-role only provider/payment lifecycle RPCs.
revoke execute on function public.cancel_checkout_order(uuid,text,text) from anon,authenticated;
grant execute on function public.cancel_checkout_order(uuid,text,text) to service_role;

revoke execute on function public.confirm_checkout_paid(uuid,text,text,text,text,text,jsonb) from anon,authenticated;
grant execute on function public.confirm_checkout_paid(uuid,text,text,text,text,text,jsonb) to service_role;

revoke execute on function public.mark_order_item_payout_released(uuid,text) from anon,authenticated;
grant execute on function public.mark_order_item_payout_released(uuid,text) to service_role;

revoke execute on function public.get_due_payout_order_items(integer) from anon,authenticated;
grant execute on function public.get_due_payout_order_items(integer) to service_role;

revoke execute on function public.get_expired_unpaid_orders(integer) from anon,authenticated;
grant execute on function public.get_expired_unpaid_orders(integer) to service_role;

revoke execute on function public.open_provider_payment_dispute(text,text,text,text,text) from anon,authenticated;
grant execute on function public.open_provider_payment_dispute(text,text,text,text,text) to service_role;

revoke execute on function public.close_provider_payment_dispute(text,text,text) from anon,authenticated;
grant execute on function public.close_provider_payment_dispute(text,text,text) to service_role;

revoke execute on function public.finalize_transaction_case_refund(uuid,text,integer,text) from anon,authenticated;
grant execute on function public.finalize_transaction_case_refund(uuid,text,integer,text) to service_role;

-- Authenticated participant/admin RPCs.
revoke execute on function public.prepare_checkout_order(uuid,integer,text) from anon;
grant execute on function public.prepare_checkout_order(uuid,integer,text) to authenticated;

revoke execute on function public.open_transaction_case(uuid,text,text,text) from anon;
grant execute on function public.open_transaction_case(uuid,text,text,text) to authenticated;

revoke execute on function public.buyer_mark_order_item_received(uuid,boolean) from anon;
grant execute on function public.buyer_mark_order_item_received(uuid,boolean) to authenticated;

revoke execute on function public.buyer_mark_transaction_return_shipped(uuid,text,text) from anon;
grant execute on function public.buyer_mark_transaction_return_shipped(uuid,text,text) to authenticated;

revoke execute on function public.seller_set_order_item_fulfilment(uuid,text,text,text) from anon;
grant execute on function public.seller_set_order_item_fulfilment(uuid,text,text,text) to authenticated;

revoke execute on function public.seller_respond_transaction_case(uuid,text) from anon;
grant execute on function public.seller_respond_transaction_case(uuid,text) to authenticated;

revoke execute on function public.seller_confirm_transaction_return_received(uuid) from anon;
grant execute on function public.seller_confirm_transaction_return_received(uuid) to authenticated;

revoke execute on function public.send_transaction_message(uuid,text) from anon;
grant execute on function public.send_transaction_message(uuid,text) to authenticated;

revoke execute on function public.register_transaction_case_evidence(uuid,text,text,text) from anon;
grant execute on function public.register_transaction_case_evidence(uuid,text,text,text) to authenticated;

revoke execute on function public.admin_authorize_transaction_return(uuid,text) from anon;
grant execute on function public.admin_authorize_transaction_return(uuid,text) to authenticated;

revoke execute on function public.admin_prepare_transaction_case_refund(uuid,text) from anon;
grant execute on function public.admin_prepare_transaction_case_refund(uuid,text) to authenticated;

revoke execute on function public.admin_prepare_returnless_refund(uuid,text) from anon;
grant execute on function public.admin_prepare_returnless_refund(uuid,text) to authenticated;

revoke execute on function public.admin_reject_transaction_case(uuid,text) from anon;
grant execute on function public.admin_reject_transaction_case(uuid,text) to authenticated;

-- Audit events are immutable to API clients; participant SELECT is enforced by RLS.
revoke all on table public.order_events from anon;
revoke insert,update,delete,truncate,references,trigger on table public.order_events from authenticated;
grant select on table public.order_events to authenticated;

-- Server-only configuration/event tables should expose no direct client privileges.
revoke all on table public.commerce_settings from anon,authenticated;
revoke all on table public.payment_events from anon,authenticated;
