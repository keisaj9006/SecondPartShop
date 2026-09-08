create or replace function public.admin_active_listing_checkout_readiness()
returns table(
  active_listings bigint,
  checkout_ready_listings bigint,
  checkout_blocked_listings bigint
)
language sql
stable
security invoker
set search_path=''
as $$
  select
    count(*)::bigint,
    count(*) filter(where public.seller_checkout_ready(p.seller_id))::bigint,
    count(*) filter(where not public.seller_checkout_ready(p.seller_id))::bigint
  from public.parts p
  where p.status='active'::public.listing_status;
$$;

revoke all on function public.admin_active_listing_checkout_readiness() from public,anon,authenticated;
grant execute on function public.admin_active_listing_checkout_readiness() to service_role;
