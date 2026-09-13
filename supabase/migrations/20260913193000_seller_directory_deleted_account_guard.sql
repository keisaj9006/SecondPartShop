-- Prevent SECURITY DEFINER public seller RPCs from bypassing the deleted-account
-- boundary enforced by the sellers RLS/public column contract.

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
set search_path = ''
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
    where s.account_deleted_at is null
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
      from private.valid_completed_order_items oi
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
      from private.valid_completed_order_items oi
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
      from private.valid_transaction_reviews r
      where r.reviewee_id=s.owner_id
        and r.direction='buyer_to_seller'
        and r.status='active'
        and r.visible_at<=now()
    ) as seller_rating,
    (
      select count(*)
      from private.valid_transaction_reviews r
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
grant execute on function public.get_seller_directory_page(integer,integer) to service_role;

create or replace function public.seller_checkout_ready(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.sellers s
    join public.seller_payment_accounts spa on spa.seller_id=s.id
    where s.id=p_seller_id
      and s.account_deleted_at is null
      and spa.onboarding_status='complete'
      and spa.transfers_enabled
  );
$$;

revoke all on function public.seller_checkout_ready(uuid) from public;
grant execute on function public.seller_checkout_ready(uuid) to anon,authenticated;
grant execute on function public.seller_checkout_ready(uuid) to service_role;

create or replace function public.get_public_member_profile(p_handle text)
returns table(
  profile_id uuid,
  handle text,
  display_name text,
  bio text,
  member_since timestamptz,
  seller_id uuid,
  seller_slug text,
  seller_name text,
  seller_type text,
  seller_verified boolean,
  sold_count bigint,
  bought_count bigint,
  seller_rating numeric,
  seller_review_count bigint,
  buyer_rating numeric,
  buyer_review_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.handle,
    p.display_name,
    p.bio,
    p.created_at,
    s.id,
    s.slug,
    s.business_name,
    s.seller_type,
    (s.verified_at is not null),
    (
      select count(*)
      from private.valid_completed_order_items oi
      join public.orders o on o.id=oi.order_id
      join public.sellers sx on sx.id=oi.seller_id
        and sx.account_deleted_at is null
      where sx.owner_id=p.id
        and oi.funds_released_at is not null
        and oi.fulfilment_status='completed'
        and oi.payout_status='released'
        and oi.refunded_at is null
        and o.payment_status='paid'
    ),
    (
      select count(*)
      from private.valid_completed_order_items oi
      join public.orders o on o.id=oi.order_id
      where o.buyer_id=p.id
        and oi.funds_released_at is not null
        and oi.fulfilment_status='completed'
        and oi.payout_status='released'
        and oi.refunded_at is null
        and o.payment_status='paid'
    ),
    (
      select round(avg(r.overall_rating)::numeric,2)
      from private.valid_transaction_reviews r
      where r.reviewee_id=p.id
        and r.direction='buyer_to_seller'
        and r.status='active'
        and r.visible_at<=now()
    ),
    (
      select count(*)
      from private.valid_transaction_reviews r
      where r.reviewee_id=p.id
        and r.direction='buyer_to_seller'
        and r.status='active'
        and r.visible_at<=now()
    ),
    (
      select round(avg(r.overall_rating)::numeric,2)
      from private.valid_transaction_reviews r
      where r.reviewee_id=p.id
        and r.direction='seller_to_buyer'
        and r.status='active'
        and r.visible_at<=now()
    ),
    (
      select count(*)
      from private.valid_transaction_reviews r
      where r.reviewee_id=p.id
        and r.direction='seller_to_buyer'
        and r.status='active'
        and r.visible_at<=now()
    )
  from public.profiles p
  left join public.sellers s on s.owner_id=p.id
    and s.account_deleted_at is null
  where p.handle=lower(btrim(p_handle))
  limit 1;
$$;

revoke all on function public.get_public_member_profile(text) from public;
grant execute on function public.get_public_member_profile(text) to anon,authenticated;
grant execute on function public.get_public_member_profile(text) to service_role;

create or replace function public.get_public_seller_inventory_summary(p_seller_id uuid)
returns table(
  active_count bigint,
  tested_count bigint,
  collection_count bigint,
  warranty_count bigint,
  category_names text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*)::bigint as active_count,
    count(*) filter(
      where p.testing_status in (
        'tested_working',
        'removed_from_running_vehicle'
      )
    )::bigint as tested_count,
    count(*) filter(where p.collection_available)::bigint as collection_count,
    count(*) filter(where p.warranty_days>0)::bigint as warranty_count,
    coalesce(
      (
        select array_agg(category_name order by part_count desc,category_name)
        from (
          select c.name as category_name,count(*)::bigint as part_count
          from public.parts p2
          join public.categories c on c.id=p2.category_id
          where p2.seller_id=p_seller_id
            and p2.status='active'::public.listing_status
            and exists(
              select 1
              from public.sellers s
              where s.id=p_seller_id
                and s.account_deleted_at is null
            )
          group by c.name
          order by count(*) desc,c.name
          limit 8
        ) ranked_categories
      ),
      array[]::text[]
    ) as category_names
  from public.parts p
  where p.seller_id=p_seller_id
    and p.status='active'::public.listing_status
    and exists(
      select 1
      from public.sellers s
      where s.id=p_seller_id
        and s.account_deleted_at is null
    );
$$;

revoke all on function public.get_public_seller_inventory_summary(uuid) from public;
grant execute on function public.get_public_seller_inventory_summary(uuid) to anon,authenticated;
grant execute on function public.get_public_seller_inventory_summary(uuid) to service_role;
