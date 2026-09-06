-- Persist seller coordinates so distance sorting can stay inside PostgreSQL.

alter table public.sellers
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists postcode_geocode_approximate boolean not null default false,
  add column if not exists postcode_geocoded_at timestamptz;

alter table public.sellers
  drop constraint if exists sellers_latitude_check;
alter table public.sellers
  add constraint sellers_latitude_check
  check (latitude is null or latitude between -90 and 90);

alter table public.sellers
  drop constraint if exists sellers_longitude_check;
alter table public.sellers
  add constraint sellers_longitude_check
  check (longitude is null or longitude between -180 and 180);

create index if not exists sellers_distance_ready_idx
  on public.sellers(id,latitude,longitude)
  where latitude is not null and longitude is not null;

create or replace function public.marketplace_distance_page(
  p_buyer_lat double precision,
  p_buyer_lon double precision,
  p_part_ids uuid[] default null,
  p_category_ids uuid[] default null,
  p_condition text default null,
  p_min_price_pence integer default null,
  p_max_price_pence integer default null,
  p_collection_only boolean default false,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table(
  part_id uuid,
  distance_miles double precision,
  distance_approximate boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path=''
as $$
  with filtered as (
    select
      p.id as part_id,
      s.postcode_geocode_approximate,
      case
        when s.latitude is null or s.longitude is null then null
        else 3958.7613 * 2 * asin(
          least(
            1.0,
            sqrt(
              power(sin(radians(s.latitude-p_buyer_lat)/2),2)
              + cos(radians(p_buyer_lat))
              * cos(radians(s.latitude))
              * power(sin(radians(s.longitude-p_buyer_lon)/2),2)
            )
          )
        )
      end as distance_miles,
      case
        when p_part_ids is null then null
        else array_position(p_part_ids,p.id)
      end as search_rank,
      p.created_at
    from public.parts p
    join public.sellers s on s.id=p.seller_id
    where p.status='active'::public.listing_status
      and (p_part_ids is null or p.id=any(p_part_ids))
      and (p_category_ids is null or p.category_id=any(p_category_ids))
      and (p_condition is null or p.condition::text=p_condition)
      and (p_min_price_pence is null or p.price_pence>=p_min_price_pence)
      and (p_max_price_pence is null or p.price_pence<=p_max_price_pence)
      and (not p_collection_only or p.collection_available)
  )
  select
    f.part_id,
    f.distance_miles,
    f.postcode_geocode_approximate,
    count(*) over() as total_count
  from filtered f
  order by
    f.distance_miles asc nulls last,
    f.search_rank asc nulls last,
    f.created_at desc,
    f.part_id
  limit greatest(1,least(coalesce(p_limit,24),60))
  offset greatest(0,coalesce(p_offset,0));
$$;

revoke all on function public.marketplace_distance_page(
  double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer
) from public;
grant execute on function public.marketplace_distance_page(
  double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer
) to anon,authenticated;
