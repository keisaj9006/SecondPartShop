insert into public.vehicle_catalogue_make_aliases(provider,source_make,canonical_make,display_name)
values
 ('dft','ŠKODA','SKODA','Skoda'),
 ('dft','SKODA','SKODA','Skoda')
on conflict(provider,source_make)
do update set canonical_make=excluded.canonical_make,display_name=excluded.display_name;

create or replace function public.marketplace_catalogue_compatibility(
 p_variant_id uuid,
 p_year smallint,
 p_fuel text default null,
 p_engine integer default null,
 p_part_id uuid default null
)
returns table(part_id uuid,confidence text)
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
  select f.part_id,'confirmed'::text as confidence,3 as rank
  from public.part_catalogue_fitments f
  where f.variant_id=p_variant_id
    and (p_part_id is null or f.part_id=p_part_id)
    and (f.year_from is null or p_year>=f.year_from)
    and (f.year_to is null or p_year<=f.year_to)
    and (f.fuel_type is null or (p_fuel is not null and upper(f.fuel_type)=upper(p_fuel)))
    and (f.engine_size_simple is null or (p_engine is not null and f.engine_size_simple=p_engine))
 ),
 catalogue_family_matches as (
  select f.part_id,'family_match'::text as confidence,2 as rank
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
 legacy_family_matches as (
  select pf.part_id,'family_match'::text as confidence,1 as rank
  from selected s
  join public.part_fitments pf on true
  join public.vehicles legacy_vehicle on legacy_vehicle.id=pf.vehicle_id
  left join public.vehicle_catalogue_make_aliases make_alias
    on make_alias.provider=s.provider
   and pg_catalog.regexp_replace(pg_catalog.upper(make_alias.source_make),'[^A-Z0-9]','','g')
       =pg_catalog.regexp_replace(pg_catalog.upper(legacy_vehicle.make),'[^A-Z0-9]','','g')
  where (p_part_id is null or pf.part_id=p_part_id)
    and legacy_vehicle.year=p_year
    and pg_catalog.regexp_replace(
      pg_catalog.upper(coalesce(make_alias.canonical_make,legacy_vehicle.make)),
      '[^A-Z0-9]',
      '',
      'g'
    )=pg_catalog.regexp_replace(pg_catalog.upper(s.make),'[^A-Z0-9]','','g')
    and pg_catalog.regexp_replace(
      pg_catalog.upper(legacy_vehicle.model),
      '[^A-Z0-9]',
      '',
      'g'
    )=pg_catalog.regexp_replace(pg_catalog.upper(s.model_family),'[^A-Z0-9]','','g')
 ),
 combined as (
  select * from exact_matches
  union all
  select * from catalogue_family_matches
  union all
  select * from legacy_family_matches
 )
 select distinct on (combined.part_id)
   combined.part_id,
   combined.confidence
 from combined
 order by combined.part_id,combined.rank desc;
$$;

revoke all on function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid) from public;
grant execute on function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid) to anon,authenticated;
