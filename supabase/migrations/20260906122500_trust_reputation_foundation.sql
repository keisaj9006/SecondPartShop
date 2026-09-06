-- Trust & reputation foundation for SecondPart.
-- Reviews are transaction-gated and only unlock after funds_released_at.

alter table public.profiles
  add column if not exists handle text,
  add column if not exists bio text;

update public.profiles
set handle = (
  case
    when length(trim(both '-' from regexp_replace(lower(display_name), '[^a-z0-9]+', '-', 'g'))) >= 3
      then left(trim(both '-' from regexp_replace(lower(display_name), '[^a-z0-9]+', '-', 'g')), 24)
    else 'member'
  end
) || '-' || substr(replace(id::text, '-', ''), 1, 6)
where handle is null;

alter table public.profiles
  alter column handle set not null;

create unique index if not exists profiles_handle_unique
  on public.profiles(handle);

alter table public.profiles
  drop constraint if exists profiles_handle_format;
alter table public.profiles
  add constraint profiles_handle_format
  check (handle ~ '^[a-z0-9][a-z0-9-]{2,31}$');

alter table public.profiles
  drop constraint if exists profiles_bio_length;
alter table public.profiles
  add constraint profiles_bio_length
  check (bio is null or char_length(bio) <= 500);

create or replace function private.ensure_profile_handle()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  base_handle text;
begin
  if new.handle is null or btrim(new.handle)='' then
    base_handle := trim(both '-' from regexp_replace(lower(new.display_name), '[^a-z0-9]+', '-', 'g'));
    if length(base_handle) < 3 then base_handle := 'member'; end if;
    new.handle := left(base_handle,24) || '-' || substr(replace(new.id::text,'-',''),1,6);
  else
    new.handle := lower(btrim(new.handle));
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_profile_handle_trigger on public.profiles;
create trigger ensure_profile_handle_trigger
before insert or update of handle,display_name on public.profiles
for each row execute function private.ensure_profile_handle();

revoke all on function private.ensure_profile_handle() from public;

alter table public.sellers
  add column if not exists seller_type text not null default 'business';

alter table public.sellers
  drop constraint if exists sellers_seller_type_check;
alter table public.sellers
  add constraint sellers_seller_type_check
  check (seller_type in ('business','private'));

alter table public.order_items
  add column if not exists fulfilment_status text not null default 'pending',
  add column if not exists dispatched_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists funds_released_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table public.order_items
  drop constraint if exists order_items_fulfilment_status_check;
alter table public.order_items
  add constraint order_items_fulfilment_status_check
  check (fulfilment_status in (
    'pending','paid','preparing','dispatched','delivered','accepted',
    'completed','cancelled','return_requested','return_approved',
    'returned','refunded','dispute_open','dispute_resolved'
  ));

create index if not exists order_items_seller_released_idx
  on public.order_items(seller_id,funds_released_at)
  where funds_released_at is not null;

create table if not exists public.transaction_reviews (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  direction text not null check (direction in ('buyer_to_seller','seller_to_buyer')),
  overall_rating smallint not null check (overall_rating between 1 and 5),
  item_as_described_rating smallint check (item_as_described_rating between 1 and 5),
  dispatch_rating smallint check (dispatch_rating between 1 and 5),
  communication_rating smallint check (communication_rating between 1 and 5),
  buyer_conduct_rating smallint check (buyer_conduct_rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now(),
  visible_at timestamptz not null default (now() + interval '14 days'),
  unique(order_item_id,reviewer_id),
  check (reviewer_id <> reviewee_id)
);

create index if not exists transaction_reviews_reviewee_idx
  on public.transaction_reviews(reviewee_id,created_at desc);
create index if not exists transaction_reviews_visible_idx
  on public.transaction_reviews(visible_at,created_at desc)
  where status='active';

create or replace function private.validate_transaction_review()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  buyer_profile uuid;
  seller_profile uuid;
  released_at timestamptz;
begin
  select o.buyer_id,s.owner_id,oi.funds_released_at
  into buyer_profile,seller_profile,released_at
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  where oi.id=new.order_item_id;

  if buyer_profile is null or seller_profile is null then
    raise exception 'Transaction participants could not be resolved.';
  end if;
  if released_at is null then
    raise exception 'Reviews unlock only after transaction funds are released.';
  end if;

  if new.direction='buyer_to_seller' then
    if new.reviewer_id<>buyer_profile or new.reviewee_id<>seller_profile then
      raise exception 'Invalid buyer-to-seller review participants.';
    end if;
  elsif new.direction='seller_to_buyer' then
    if new.reviewer_id<>seller_profile or new.reviewee_id<>buyer_profile then
      raise exception 'Invalid seller-to-buyer review participants.';
    end if;
  else
    raise exception 'Invalid review direction.';
  end if;

  new.visible_at := now() + interval '14 days';
  return new;
end;
$$;

create or replace function private.publish_review_pair()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if exists (
    select 1
    from public.transaction_reviews r
    where r.order_item_id=new.order_item_id
      and r.id<>new.id
      and r.direction<>new.direction
      and r.status='active'
  ) then
    update public.transaction_reviews
    set visible_at=now()
    where order_item_id=new.order_item_id
      and status='active';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_transaction_review_trigger on public.transaction_reviews;
create trigger validate_transaction_review_trigger
before insert on public.transaction_reviews
for each row execute function private.validate_transaction_review();

drop trigger if exists publish_review_pair_trigger on public.transaction_reviews;
create trigger publish_review_pair_trigger
after insert on public.transaction_reviews
for each row execute function private.publish_review_pair();

revoke all on function private.validate_transaction_review() from public;
revoke all on function private.publish_review_pair() from public;

alter table public.transaction_reviews enable row level security;

drop policy if exists "transaction reviews public visible" on public.transaction_reviews;
create policy "transaction reviews public visible"
  on public.transaction_reviews for select
  to anon,authenticated
  using (
    (status='active' and visible_at<=now())
    or reviewer_id=(select auth.uid())
    or private.is_admin()
  );

drop policy if exists "transaction reviews reviewer insert" on public.transaction_reviews;
create policy "transaction reviews reviewer insert"
  on public.transaction_reviews for insert
  to authenticated
  with check (reviewer_id=(select auth.uid()));

grant select on public.transaction_reviews to anon,authenticated;
grant insert on public.transaction_reviews to authenticated;

drop policy if exists "orders seller read" on public.orders;
create policy "orders seller read"
  on public.orders for select
  to authenticated
  using (
    exists (
      select 1
      from public.order_items oi
      join public.sellers s on s.id=oi.seller_id
      where oi.order_id=orders.id
        and s.owner_id=(select auth.uid())
    )
  );

drop policy if exists "order items seller read" on public.order_items;
create policy "order items seller read"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.sellers s
      where s.id=order_items.seller_id
        and s.owner_id=(select auth.uid())
    )
  );

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
      join public.sellers sx on sx.id=oi.seller_id
      where sx.owner_id=p.id and oi.funds_released_at is not null
    ),
    (
      select count(*)
      from public.order_items oi
      join public.orders o on o.id=oi.order_id
      where o.buyer_id=p.id and oi.funds_released_at is not null
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

create or replace function public.get_public_member_profile_by_id(p_profile_id uuid)
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
  select *
  from public.get_public_member_profile(
    (select p.handle from public.profiles p where p.id=p_profile_id)
  );
$$;

create or replace function public.get_public_member_reviews(
  p_profile_id uuid,
  p_limit integer default 20
)
returns table(
  review_id uuid,
  reviewer_handle text,
  reviewer_display_name text,
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

revoke all on function public.get_public_member_profile(text) from public;
revoke all on function public.get_public_member_profile_by_id(uuid) from public;
revoke all on function public.get_public_member_reviews(uuid,integer) from public;
grant execute on function public.get_public_member_profile(text) to anon,authenticated;
grant execute on function public.get_public_member_profile_by_id(uuid) to anon,authenticated;
grant execute on function public.get_public_member_reviews(uuid,integer) to anon,authenticated;
