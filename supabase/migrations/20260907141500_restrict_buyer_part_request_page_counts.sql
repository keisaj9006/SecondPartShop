revoke execute on function public.buyer_part_request_match_counts_for_ids(uuid[]) from public;
revoke execute on function public.buyer_part_request_match_counts_for_ids(uuid[]) from anon;
grant execute on function public.buyer_part_request_match_counts_for_ids(uuid[]) to authenticated;
