create or replace function public.marketplace_catalogue_compatibility(
  p_variant_id uuid,
  p_year smallint,
  p_fuel text default null,
  p_engine integer default null,
  p_part_id uuid default null
)
returns table(part_id uuid, confidence text)
language sql
stable
set search_path=''
as $$
  with selected as (
    select v.provider,v.make,v.model_family,v.body_type
    from public.vehicle_catalogue_variants v
    where v.id=p_variant_id
  ),
  exact_matches as (
    select f.part_id,'confirmed'::text as confidence,2 as rank
    from public.part_catalogue_fitments f
    where f.variant_id=p_variant_id
      and (p_part_id is null or f.part_id=p_part_id)
      and (f.year_from is null or p_year>=f.year_from)
      and (f.year_to is null or p_year<=f.year_to)
      and (f.fuel_type is null or (p_fuel is not null and upper(f.fuel_type)=upper(p_fuel)))
      and (f.engine_size_simple is null or (p_engine is not null and f.engine_size_simple=p_engine))
  ),
  family_matches as (
    select f.part_id,'family_match'::text as confidence,1 as rank
    from selected s
    join public.vehicle_catalogue_variants sibling
      on sibling.provider=s.provider
     and sibling.body_type is not distinct from s.body_type
     and sibling.make=s.make
     and sibling.model_family=s.model_family
     and sibling.id<>p_variant_id
    join public.part_catalogue_fitments f on f.variant_id=sibling.id
    where (p_part_id is null or f.part_id=p_part_id)
      and (f.year_from is null or p_year>=f.year_from)
      and (f.year_to is null or p_year<=f.year_to)
      and (f.fuel_type is null or (p_fuel is not null and upper(f.fuel_type)=upper(p_fuel)))
      and (f.engine_size_simple is null or (p_engine is not null and f.engine_size_simple=p_engine))
  ),
  combined as (
    select * from exact_matches
    union all
    select * from family_matches
  )
  select distinct on (combined.part_id) combined.part_id,combined.confidence
  from combined
  order by combined.part_id,combined.rank desc;
$$;

create or replace function public.marketplace_legacy_vehicle_compatibility(
  p_vehicle_id uuid,
  p_part_id uuid default null
)
returns table(part_id uuid, confidence text)
language sql
stable
set search_path=''
as $$
  with target as (
    select v.make,v.model,v.generation,v.year,v.engine,v.fuel_type
    from public.vehicles v
    where v.id=p_vehicle_id
  ),
  exact_matches as (
    select f.part_id,'confirmed'::text as confidence,2 as rank
    from public.part_fitments f
    where f.vehicle_id=p_vehicle_id
      and (p_part_id is null or f.part_id=p_part_id)
  ),
  family_matches as (
    select f.part_id,'family_match'::text as confidence,1 as rank
    from target t
    join public.vehicles sibling
      on sibling.make=t.make
     and sibling.model=t.model
     and sibling.generation=t.generation
     and sibling.year=t.year
     and sibling.engine=t.engine
     and sibling.fuel_type is not distinct from t.fuel_type
     and sibling.id<>p_vehicle_id
    join public.part_fitments f on f.vehicle_id=sibling.id
    where (p_part_id is null or f.part_id=p_part_id)
  ),
  combined as (
    select * from exact_matches
    union all
    select * from family_matches
  )
  select distinct on (combined.part_id) combined.part_id,combined.confidence
  from combined
  order by combined.part_id,combined.rank desc;
$$;

revoke all on function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid) from public;
grant execute on function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid) to anon,authenticated;

revoke all on function public.marketplace_legacy_vehicle_compatibility(uuid,uuid) from public;
grant execute on function public.marketplace_legacy_vehicle_compatibility(uuid,uuid) to anon,authenticated;
