create or replace function public.buyer_part_request_match_counts_for_ids(request_ids uuid[])
returns table(
  request_id uuid,
  matching_seller_count integer,
  verified_seller_count integer
)
language sql
stable
security definer
set search_path=''
as $$
  select
    r.id as request_id,
    count(distinct m.seller_id) filter(where m.status<>'dismissed')::integer as matching_seller_count,
    count(distinct m.seller_id) filter(where m.status<>'dismissed' and s.verified_at is not null)::integer as verified_seller_count
  from public.part_requests r
  left join public.seller_part_request_matches m on m.request_id=r.id
  left join public.sellers s on s.id=m.seller_id
  where r.profile_id=auth.uid()
    and r.status='open'
    and cardinality(coalesce(request_ids,'{}'::uuid[])) between 1 and 100
    and r.id=any(coalesce(request_ids,'{}'::uuid[]))
  group by r.id;
$$;

revoke all on function public.buyer_part_request_match_counts_for_ids(uuid[]) from public;
grant execute on function public.buyer_part_request_match_counts_for_ids(uuid[]) to authenticated;
