create or replace function public.admin_find_my_part_metrics(p_since timestamptz)
returns table(
  requests bigint,
  matched_requests bigint,
  responded_requests bigint,
  paid_requests bigint,
  completed_requests bigint
)
language sql
stable
security definer
set search_path=''
as $$
  with scoped as (
    select r.id
    from public.part_requests r
    where r.created_at>=coalesce(p_since,'1970-01-01'::timestamptz)
  )
  select
    count(*)::bigint as requests,
    count(*) filter (
      where exists (
        select 1
        from public.seller_part_request_matches m
        where m.request_id=scoped.id
          and m.status<>'dismissed'
      )
    )::bigint as matched_requests,
    count(*) filter (
      where exists (
        select 1
        from public.parts p
        where p.source_request_id=scoped.id
          and p.status in ('active','reserved','sold')
      )
    )::bigint as responded_requests,
    count(*) filter (
      where exists (
        select 1
        from public.parts p
        join public.order_items oi on oi.part_id=p.id
        join public.orders o on o.id=oi.order_id
        where p.source_request_id=scoped.id
          and o.payment_status in ('paid','partially_refunded','disputed')
      )
    )::bigint as paid_requests,
    count(*) filter (
      where exists (
        select 1
        from public.parts p
        join public.order_items oi on oi.part_id=p.id
        where p.source_request_id=scoped.id
          and oi.funds_released_at is not null
          and oi.refunded_at is null
      )
    )::bigint as completed_requests
  from scoped;
$$;

revoke all on function public.admin_find_my_part_metrics(timestamptz) from public,anon,authenticated;
grant execute on function public.admin_find_my_part_metrics(timestamptz) to service_role;
