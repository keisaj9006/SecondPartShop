-- Paginated public seller directory with trust metrics in one query.
create or replace function public.get_seller_directory_page(
  p_limit integer default 24,
  p_offset integer default 0
)
returns table(
  seller_id uuid,
  owner_id uuid,
  business_name text,
  slug text,
  location text,
  description text,
  seller_type text,
  seller_verified boolean,
  handle text,
  sold_count bigint,
  bought_count bigint,
  seller_rating numeric,
  seller_review_count bigint
)
language sql
stable
security definer
set search_path=''
as $$
  with seller_page as (
    select
      s.id,
      s.owner_id,
      s.business_name,
      s.slug,
      s.location,
      s.description,
      s.seller_type,
      (s.verified_at is not null) as seller_verified
    from public.sellers s
    order by (s.verified_at is not null) desc,s.business_name,s.id
    limit greatest(1,least(coalesce(p_limit,24),60))+1
    offset greatest(0,coalesce(p_offset,0))
  )
  select
    s.id,
    s.owner_id,
    s.business_name,
    s.slug,
    s.location,
    s.description,
    s.seller_type,
    s.seller_verified,
    p.handle,
    (
      select count(*)
      from public.order_items oi
      join public.orders o on o.id=oi.order_id
      where oi.seller_id=s.id
        and oi.funds_released_at is not null
        and oi.fulfilment_status='completed'
        and oi.payout_status='released'
        and oi.refunded_at is null
        and o.payment_status='paid'
    ) as sold_count,
    (
      select count(*)
      from public.order_items oi
      join public.orders o on o.id=oi.order_id
      where o.buyer_id=s.owner_id
        and oi.funds_released_at is not null
        and oi.fulfilment_status='completed'
        and oi.payout_status='released'
        and oi.refunded_at is null
        and o.payment_status='paid'
    ) as bought_count,
    (
      select round(avg(r.overall_rating)::numeric,2)
      from public.transaction_reviews r
      where r.reviewee_id=s.owner_id
        and r.direction='buyer_to_seller'
        and r.status='active'
        and r.visible_at<=now()
    ) as seller_rating,
    (
      select count(*)
      from public.transaction_reviews r
      where r.reviewee_id=s.owner_id
        and r.direction='buyer_to_seller'
        and r.status='active'
        and r.visible_at<=now()
    ) as seller_review_count
  from seller_page s
  left join public.profiles p on p.id=s.owner_id
  order by s.seller_verified desc,s.business_name,s.id;
$$;

revoke all on function public.get_seller_directory_page(integer,integer) from public;
grant execute on function public.get_seller_directory_page(integer,integer) to anon,authenticated;
