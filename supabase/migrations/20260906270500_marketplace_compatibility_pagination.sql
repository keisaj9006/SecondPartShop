-- Page vehicle compatibility inside PostgreSQL so the app never needs to
-- hydrate the complete fitment graph before showing one marketplace page.

create index if not exists part_catalogue_fitments_variant_match_idx
  on public.part_catalogue_fitments(
    variant_id,part_id,year_from,year_to,fuel_type,engine_size_simple
  );

create index if not exists verified_fit_feedback_vehicle_result_idx
  on public.verified_fit_feedback(
    variant_id,year,fuel_type,engine_size_simple,part_id,result,buyer_id
  );

create index if not exists donor_vehicles_compat_lookup_idx
  on public.donor_vehicles(
    (regexp_replace(upper(make),'[^A-Z0-9]','','g')),
    (regexp_replace(upper(model),'[^A-Z0-9]','','g')),
    year,
    engine_size_simple
  );

create or replace function public.marketplace_catalogue_page(
  p_variant_id uuid,
  p_year smallint,
  p_fuel text default null,
  p_engine integer default null,
  p_part_ids uuid[] default null,
  p_category_ids uuid[] default null,
  p_condition text default null,
  p_min_price_pence integer default null,
  p_max_price_pence integer default null,
  p_collection_only boolean default false,
  p_compatible_only boolean default true,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table(
  part_id uuid,
  confidence text,
  total_count bigint
)
language sql
stable
security definer
set search_path=''
as $$
  with selected as (
    select v.provider,v.make,v.model_family,v.body_type
    from public.vehicle_catalogue_variants v
    where v.id=p_variant_id
  ),
  exact_matches as (
    select f.part_id,'confirmed'::text as confidence,4 as confidence_rank
    from public.part_catalogue_fitments f
    where f.variant_id=p_variant_id
      and (p_part_ids is null or f.part_id=any(p_part_ids))
      and (f.year_from is null or p_year>=f.year_from)
      and (f.year_to is null or p_year<=f.year_to)
      and (f.fuel_type is null or (p_fuel is not null and upper(f.fuel_type)=upper(p_fuel)))
      and (f.engine_size_simple is null or (p_engine is not null and f.engine_size_simple=p_engine))
  ),
  buyer_verified_matches as (
    select
      f.part_id,
      'buyer_verified'::text as confidence,
      3 as confidence_rank
    from public.verified_fit_feedback f
    where f.variant_id=p_variant_id
      and f.year=p_year
      and (p_part_ids is null or f.part_id=any(p_part_ids))
      and (p_fuel is null or (f.fuel_type is not null and upper(f.fuel_type)=upper(p_fuel)))
      and (p_engine is null or f.engine_size_simple=p_engine)
    group by f.part_id
    having
      count(distinct f.buyer_id) filter(where f.result='exact_fit')>=2
      and count(distinct f.buyer_id) filter(where f.result='exact_fit')
          >= greatest(
            2,
            3*count(distinct f.buyer_id) filter(where f.result='did_not_fit')
          )
  ),
  family_matches as (
    select f.part_id,'family_match'::text as confidence,2 as confidence_rank
    from selected s
    join public.vehicle_catalogue_variants sibling
      on sibling.provider=s.provider
     and sibling.body_type is not distinct from s.body_type
     and sibling.make=s.make
     and sibling.model_family=s.model_family
     and sibling.id<>p_variant_id
    join public.part_catalogue_fitments f on f.variant_id=sibling.id
    where (p_part_ids is null or f.part_id=any(p_part_ids))
      and (f.year_from is null or p_year>=f.year_from)
      and (f.year_to is null or p_year<=f.year_to)
      and (f.fuel_type is null or (p_fuel is not null and upper(f.fuel_type)=upper(p_fuel)))
      and (f.engine_size_simple is null or (p_engine is not null and f.engine_size_simple=p_engine))
  ),
  donor_matches as (
    select p.id as part_id,'family_match'::text as confidence,1 as confidence_rank
    from selected s
    join public.parts p
      on p.donor_vehicle_id is not null
     and (p_part_ids is null or p.id=any(p_part_ids))
    join public.donor_vehicles d on d.id=p.donor_vehicle_id
    where regexp_replace(upper(d.make),'[^A-Z0-9]','','g')
          =regexp_replace(upper(s.make),'[^A-Z0-9]','','g')
      and regexp_replace(upper(d.model),'[^A-Z0-9]','','g')
          =regexp_replace(upper(s.model_family),'[^A-Z0-9]','','g')
      and d.year=p_year
      and (
        d.fuel_type is null
        or p_fuel is null
        or regexp_replace(upper(d.fuel_type),'[^A-Z0-9]','','g')
           =regexp_replace(upper(p_fuel),'[^A-Z0-9]','','g')
      )
      and (d.engine_size_simple is null or p_engine is null or d.engine_size_simple=p_engine)
  ),
  compatibility as (
    select distinct on (combined.part_id)
      combined.part_id,
      combined.confidence,
      combined.confidence_rank
    from (
      select * from exact_matches
      union all
      select * from buyer_verified_matches
      union all
      select * from family_matches
      union all
      select * from donor_matches
    ) combined
    order by combined.part_id,combined.confidence_rank desc
  ),
  filtered as (
    select
      p.id as part_id,
      coalesce(c.confidence,'unverified') as confidence,
      coalesce(c.confidence_rank,0) as confidence_rank,
      p.created_at,
      case
        when p_part_ids is null then null
        else array_position(p_part_ids,p.id)
      end as search_rank
    from public.parts p
    left join compatibility c on c.part_id=p.id
    where p.status='active'::public.listing_status
      and (p_part_ids is null or p.id=any(p_part_ids))
      and (p_category_ids is null or p.category_id=any(p_category_ids))
      and (p_condition is null or p.condition::text=p_condition)
      and (p_min_price_pence is null or p.price_pence>=p_min_price_pence)
      and (p_max_price_pence is null or p.price_pence<=p_max_price_pence)
      and (not p_collection_only or p.collection_available)
      and (not p_compatible_only or c.part_id is not null)
  )
  select
    f.part_id,
    f.confidence,
    count(*) over() as total_count
  from filtered f
  order by
    f.confidence_rank desc,
    f.search_rank asc nulls last,
    f.created_at desc,
    f.part_id
  limit greatest(1,least(coalesce(p_limit,24),60))
  offset greatest(0,coalesce(p_offset,0));
$$;

revoke all on function public.marketplace_catalogue_page(
  uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer
) from public;
grant execute on function public.marketplace_catalogue_page(
  uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer
) to anon,authenticated;
