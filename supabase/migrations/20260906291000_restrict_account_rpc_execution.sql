revoke execute on function public.buyer_part_request_match_counts() from anon;
revoke execute on function public.dismiss_seller_part_request_match(uuid) from anon;
revoke execute on function public.get_existing_csv_inventory_references(text[]) from anon;
revoke execute on function public.seller_import_batch_readiness(uuid) from anon;
revoke execute on function public.publish_ready_import_batch(uuid) from anon;
revoke execute on function public.seller_ranked_part_request_leads(integer,integer) from anon;
revoke execute on function public.get_verified_fit_opportunities() from anon;

grant execute on function public.buyer_part_request_match_counts() to authenticated;
grant execute on function public.dismiss_seller_part_request_match(uuid) to authenticated;
grant execute on function public.get_existing_csv_inventory_references(text[]) to authenticated;
grant execute on function public.seller_import_batch_readiness(uuid) to authenticated;
grant execute on function public.publish_ready_import_batch(uuid) to authenticated;
grant execute on function public.seller_ranked_part_request_leads(integer,integer) to authenticated;
grant execute on function public.get_verified_fit_opportunities() to authenticated;
