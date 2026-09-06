-- Review submission API and eligible review queue.

create or replace function public.get_review_opportunities()
returns table(
  order_item_id uuid,
  direction text,
  counterpart_profile_id uuid,
  counterpart_handle text,
  counterpart_display_name text,
  part_title text,
  funds_released_at timestamptz,
  existing_review_id uuid
)
language sql
stable
security definer
set search_path=''
as $$
  with me as (select auth.uid() as id)
  select
    oi.id,
    'buyer_to_seller'::text,
    seller_profile.id,
    seller_profile.handle,
    seller_profile.display_name,
    p.title,
    oi.funds_released_at,
    r.id
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  join public.profiles seller_profile on seller_profile.id=s.owner_id
  join public.parts p on p.id=oi.part_id
  cross join me
  left join public.transaction_reviews r
    on r.order_item_id=oi.id and r.reviewer_id=me.id
  where me.id is not null
    and o.buyer_id=me.id
    and oi.funds_released_at is not null

  union all

  select
    oi.id,
    'seller_to_buyer'::text,
    buyer_profile.id,
    buyer_profile.handle,
    buyer_profile.display_name,
    p.title,
    oi.funds_released_at,
    r.id
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  join public.profiles buyer_profile on buyer_profile.id=o.buyer_id
  join public.parts p on p.id=oi.part_id
  cross join me
  left join public.transaction_reviews r
    on r.order_item_id=oi.id and r.reviewer_id=me.id
  where me.id is not null
    and s.owner_id=me.id
    and oi.funds_released_at is not null

  order by funds_released_at desc;
$$;

create or replace function public.submit_transaction_review(
  p_order_item_id uuid,
  p_overall_rating smallint,
  p_item_as_described_rating smallint default null,
  p_dispatch_rating smallint default null,
  p_communication_rating smallint default null,
  p_buyer_conduct_rating smallint default null,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  current_profile uuid := auth.uid();
  buyer_profile uuid;
  seller_profile uuid;
  released_at timestamptz;
  review_direction text;
  target_profile uuid;
  created_review uuid;
begin
  if current_profile is null then
    raise exception 'Authentication required.';
  end if;

  select o.buyer_id,s.owner_id,oi.funds_released_at
  into buyer_profile,seller_profile,released_at
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  where oi.id=p_order_item_id;

  if buyer_profile is null or seller_profile is null then
    raise exception 'Transaction not found.';
  end if;

  if released_at is null then
    raise exception 'Reviews unlock only after transaction funds are released.';
  end if;

  if current_profile=buyer_profile then
    review_direction := 'buyer_to_seller';
    target_profile := seller_profile;
    p_buyer_conduct_rating := null;
  elsif current_profile=seller_profile then
    review_direction := 'seller_to_buyer';
    target_profile := buyer_profile;
    p_item_as_described_rating := null;
    p_dispatch_rating := null;
  else
    raise exception 'You are not a participant in this transaction.';
  end if;

  if p_overall_rating not between 1 and 5 then
    raise exception 'Overall rating must be between 1 and 5.';
  end if;

  insert into public.transaction_reviews(
    order_item_id,
    reviewer_id,
    reviewee_id,
    direction,
    overall_rating,
    item_as_described_rating,
    dispatch_rating,
    communication_rating,
    buyer_conduct_rating,
    comment
  )
  values(
    p_order_item_id,
    current_profile,
    target_profile,
    review_direction,
    p_overall_rating,
    p_item_as_described_rating,
    p_dispatch_rating,
    p_communication_rating,
    p_buyer_conduct_rating,
    nullif(left(btrim(coalesce(p_comment,'')),2000),'')
  )
  returning id into created_review;

  return created_review;
exception
  when unique_violation then
    raise exception 'You have already reviewed this transaction.';
end;
$$;

revoke all on function public.get_review_opportunities() from public;
revoke all on function public.submit_transaction_review(uuid,smallint,smallint,smallint,smallint,smallint,text) from public;
grant execute on function public.get_review_opportunities() to authenticated;
grant execute on function public.submit_transaction_review(uuid,smallint,smallint,smallint,smallint,smallint,text) to authenticated;
