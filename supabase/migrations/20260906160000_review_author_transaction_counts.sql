-- Include transaction history counters next to review-author identity.

drop function if exists public.get_public_member_reviews(uuid,integer);

create function public.get_public_member_reviews(
  p_profile_id uuid,
  p_limit integer default 20
)
returns table(
  review_id uuid,
  reviewer_handle text,
  reviewer_display_name text,
  reviewer_sold_count bigint,
  reviewer_bought_count bigint,
  direction text,
  overall_rating smallint,
  item_as_described_rating smallint,
  dispatch_rating smallint,
  communication_rating smallint,
  buyer_conduct_rating smallint,
  comment text,
  created_at timestamptz,
  part_title text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    r.id,
    reviewer.handle,
    reviewer.display_name,
    (
      select count(*)
      from public.order_items sold_item
      join public.sellers sold_seller on sold_seller.id=sold_item.seller_id
      where sold_seller.owner_id=reviewer.id
        and sold_item.funds_released_at is not null
    ),
    (
      select count(*)
      from public.order_items bought_item
      join public.orders bought_order on bought_order.id=bought_item.order_id
      where bought_order.buyer_id=reviewer.id
        and bought_item.funds_released_at is not null
    ),
    r.direction,
    r.overall_rating,
    r.item_as_described_rating,
    r.dispatch_rating,
    r.communication_rating,
    r.buyer_conduct_rating,
    r.comment,
    r.created_at,
    part.title
  from public.transaction_reviews r
  join public.profiles reviewer on reviewer.id=r.reviewer_id
  join public.order_items oi on oi.id=r.order_item_id
  join public.parts part on part.id=oi.part_id
  where r.reviewee_id=p_profile_id
    and r.status='active'
    and r.visible_at<=now()
  order by r.created_at desc
  limit greatest(1,least(coalesce(p_limit,20),100));
$$;

revoke all on function public.get_public_member_reviews(uuid,integer) from public;
grant execute on function public.get_public_member_reviews(uuid,integer) to anon,authenticated;
