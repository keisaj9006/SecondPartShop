-- Reputation integrity after refunds, reversals and disputes.

alter table public.transaction_reviews
  add column if not exists removed_reason text,
  add column if not exists removed_at timestamptz;

alter table public.transaction_reviews
  drop constraint if exists transaction_reviews_removed_reason_length;
alter table public.transaction_reviews
  add constraint transaction_reviews_removed_reason_length
  check (removed_reason is null or char_length(removed_reason)<=160);

create or replace function private.remove_reviews_for_failed_order_item()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if (
    new.refunded_at is not null
    or new.fulfilment_status='refunded'
    or new.payout_status='reversed'
  ) and not (
    old.refunded_at is not null
    or old.fulfilment_status='refunded'
    or old.payout_status='reversed'
  ) then
    update public.transaction_reviews
    set
      status='removed',
      removed_reason='transaction_refunded_or_reversed',
      removed_at=coalesce(removed_at,now())
    where order_item_id=new.id
      and status='active';
  end if;
  return new;
end;
$$;

drop trigger if exists remove_reviews_for_failed_order_item on public.order_items;
create trigger remove_reviews_for_failed_order_item
after update of refunded_at,fulfilment_status,payout_status on public.order_items
for each row execute function private.remove_reviews_for_failed_order_item();

create or replace function private.remove_reviews_for_lost_provider_dispute()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.provider_dispute_status='lost'
     and old.provider_dispute_status is distinct from new.provider_dispute_status then
    update public.transaction_reviews
    set
      status='removed',
      removed_reason='provider_dispute_lost',
      removed_at=coalesce(removed_at,now())
    where order_item_id=new.order_item_id
      and status='active';
  end if;
  return new;
end;
$$;

drop trigger if exists remove_reviews_for_lost_provider_dispute on public.transaction_cases;
create trigger remove_reviews_for_lost_provider_dispute
after update of provider_dispute_status on public.transaction_cases
for each row execute function private.remove_reviews_for_lost_provider_dispute();

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
set search_path=''
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
      from public.order_items oi
      join public.orders o on o.id=oi.order_id
      join public.sellers sx on sx.id=oi.seller_id
      where sx.owner_id=p.id
        and oi.funds_released_at is not null
        and oi.fulfilment_status='completed'
        and oi.payout_status='released'
        and oi.refunded_at is null
        and o.payment_status='paid'
    ),
    (
      select count(*)
      from public.order_items oi
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
      from public.transaction_reviews r
      where r.reviewee_id=p.id
        and r.direction='buyer_to_seller'
        and r.status='active'
        and r.visible_at<=now()
    ),
    (
      select count(*)
      from public.transaction_reviews r
      where r.reviewee_id=p.id
        and r.direction='buyer_to_seller'
        and r.status='active'
        and r.visible_at<=now()
    ),
    (
      select round(avg(r.overall_rating)::numeric,2)
      from public.transaction_reviews r
      where r.reviewee_id=p.id
        and r.direction='seller_to_buyer'
        and r.status='active'
        and r.visible_at<=now()
    ),
    (
      select count(*)
      from public.transaction_reviews r
      where r.reviewee_id=p.id
        and r.direction='seller_to_buyer'
        and r.status='active'
        and r.visible_at<=now()
    )
  from public.profiles p
  left join public.sellers s on s.owner_id=p.id
  where p.handle=lower(btrim(p_handle))
  limit 1;
$$;

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
    and o.payment_status='paid'
    and oi.funds_released_at is not null
    and oi.fulfilment_status='completed'
    and oi.payout_status='released'
    and oi.refunded_at is null
    and not exists(
      select 1 from public.transaction_cases c
      where c.order_item_id=oi.id
        and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
    )

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
    and o.payment_status='paid'
    and oi.funds_released_at is not null
    and oi.fulfilment_status='completed'
    and oi.payout_status='released'
    and oi.refunded_at is null
    and not exists(
      select 1 from public.transaction_cases c
      where c.order_item_id=oi.id
        and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
    )

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
  current_profile uuid:=auth.uid();
  buyer_profile uuid;
  seller_profile uuid;
  released_at timestamptz;
  item_fulfilment text;
  item_payout text;
  item_refunded timestamptz;
  order_payment text;
  review_direction text;
  target_profile uuid;
  created_review uuid;
begin
  if current_profile is null then
    raise exception 'Authentication required.';
  end if;

  select
    o.buyer_id,
    s.owner_id,
    oi.funds_released_at,
    oi.fulfilment_status,
    oi.payout_status,
    oi.refunded_at,
    o.payment_status
  into
    buyer_profile,
    seller_profile,
    released_at,
    item_fulfilment,
    item_payout,
    item_refunded,
    order_payment
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  where oi.id=p_order_item_id;

  if buyer_profile is null or seller_profile is null then
    raise exception 'Transaction not found.';
  end if;

  if released_at is null
     or item_fulfilment<>'completed'
     or item_payout<>'released'
     or item_refunded is not null
     or order_payment<>'paid' then
    raise exception 'Reviews unlock only after a successfully completed, non-refunded transaction.';
  end if;

  if exists(
    select 1
    from public.transaction_cases c
    where c.order_item_id=p_order_item_id
      and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
  ) then
    raise exception 'Reviews are paused while a transaction case is active.';
  end if;

  if current_profile=buyer_profile then
    review_direction:='buyer_to_seller';
    target_profile:=seller_profile;
    p_buyer_conduct_rating:=null;
  elsif current_profile=seller_profile then
    review_direction:='seller_to_buyer';
    target_profile:=buyer_profile;
    p_item_as_described_rating:=null;
    p_dispatch_rating:=null;
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

revoke execute on function public.submit_transaction_review(uuid,smallint,smallint,smallint,smallint,smallint,text) from anon;
grant execute on function public.submit_transaction_review(uuid,smallint,smallint,smallint,smallint,smallint,text) to authenticated;
