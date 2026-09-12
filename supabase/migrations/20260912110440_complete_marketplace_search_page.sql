-- Complete marketplace search: no candidate truncation before eligibility and order.
-- Autosuggest and no-query browse RPC contracts remain unchanged.
create or replace function public.marketplace_search_page_v1(
 p_query text,p_sort text default 'best',p_category_ids uuid[] default null,
 p_condition text default null,p_min_price_pence integer default null,p_max_price_pence integer default null,
 p_collection_only boolean default false,p_variant_id uuid default null,p_year smallint default null,
 p_fuel text default null,p_engine integer default null,p_vehicle_id uuid default null,
 p_compatible_only boolean default true,p_buyer_lat double precision default null,p_buyer_lon double precision default null,
 p_part_ids uuid[] default null,p_limit integer default 24,p_offset integer default 0
)
returns table(part_id uuid,confidence text,distance_miles double precision,distance_approximate boolean)
language plpgsql stable security definer set search_path=''
as $$
begin
 if (p_variant_id is null) <> (p_year is null) or
   (p_variant_id is not null and not exists(select 1 from public.vehicle_catalogue_variants v where v.id=p_variant_id)) then
  raise exception 'Invalid catalogue vehicle context' using errcode='22023';
 end if;
 if p_variant_id is null and p_vehicle_id is not null and not exists(select 1 from public.vehicles v where v.id=p_vehicle_id) then
  raise exception 'Invalid legacy vehicle context' using errcode='22023';
 end if;
 if (p_buyer_lat is null) <> (p_buyer_lon is null)
   or (p_buyer_lat is not null and not (p_buyer_lat between -90 and 90 and p_buyer_lon between -180 and 180))
   or (p_sort='distance' and p_buyer_lat is null) then
  raise exception 'Invalid buyer coordinates' using errcode='22023';
 end if;
 if coalesce(btrim(p_query),'')='' then return; end if;
 return query
 with recursive category_ancestors as (
  select
   c.id category_id,
   c.parent_id,
   pg_catalog.concat_ws(
    ' ',
    c.name,
    c.slug,
    pg_catalog.array_to_string(c.search_terms,' ')
   ) searchable
  from public.categories c

  union all

  select
   child.category_id,
   parent.parent_id,
   pg_catalog.concat_ws(
    ' ',
    child.searchable,
    parent.name,
    parent.slug
   )
  from category_ancestors child
  join public.categories parent on parent.id=child.parent_id
 ),
 category_search as (
  select category_id,pg_catalog.string_agg(searchable,' ') searchable
  from category_ancestors
  group by category_id
 ),

 literal_query as (select btrim(p_query) raw_query,lower(btrim(p_query)) lower_query,regexp_replace(lower(btrim(p_query)),'[^a-z0-9]','','g') compact_query,websearch_to_tsquery('english',p_query) ts_query),
 -- Fallback is global public text existence, independent of optional filters/offset.
 resolved_query as (
  select case when exists(
   select 1 from public.parts p join public.sellers s on s.id=p.seller_id
   join public.categories leaf on leaf.id=p.category_id cross join literal_query q
   where p.status='active'::public.listing_status and s.account_deleted_at is null
    and ((p.search_document@@q.ts_query) or (lower(p.title) like '%'||q.lower_query||'%') or (lower(coalesce(p.manufacturer,'')) like '%'||q.lower_query||'%') or (p.oem_number is not null and q.compact_query<>'' and regexp_replace(lower(coalesce(p.oem_number,'')),'[^a-z0-9]','','g') like '%'||q.compact_query||'%') or (p.part_number is not null and q.compact_query<>'' and regexp_replace(lower(coalesce(p.part_number,'')),'[^a-z0-9]','','g') like '%'||q.compact_query||'%') or (p.gearbox_code is not null and lower(coalesce(p.gearbox_code,'')) like '%'||q.lower_query||'%') or (p.gearbox_family is not null and lower(coalesce(p.gearbox_family,'')) like '%'||q.lower_query||'%') or (p.category_id in (select category_id from category_search where lower(searchable) like '%'||q.lower_query||'%')))
  ) then p_query else coalesce((select canonical_query from public.marketplace_search_synonyms where alias=lower(btrim(p_query))),p_query) end value
 ),
 prepared_query as (select btrim((select value from resolved_query)) raw_query,lower(btrim((select value from resolved_query))) lower_query,regexp_replace(lower(btrim((select value from resolved_query))),'[^a-z0-9]','','g') compact_query,websearch_to_tsquery('english',(select value from resolved_query)) ts_query),
 eligible as not materialized (
  select p.* from public.parts p join public.sellers s on s.id=p.seller_id
  where p.status='active'::public.listing_status and s.account_deleted_at is null
   and (p_category_ids is null or p.category_id=any(p_category_ids))
   and (p_condition is null or p.condition::text=p_condition)
   and (p_min_price_pence is null or p.price_pence>=p_min_price_pence)
   and (p_max_price_pence is null or p.price_pence<=p_max_price_pence)
   and (not coalesce(p_collection_only,false) or p.collection_available)
   and (p_part_ids is null or p.id=any(p_part_ids))
 ),
 candidate_ids as (
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and p.search_document@@q.ts_query
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and lower(p.title) like '%'||q.lower_query||'%'
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and lower(coalesce(p.manufacturer,'')) like '%'||q.lower_query||'%'
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and p.oem_number is not null and q.compact_query<>'' and regexp_replace(lower(coalesce(p.oem_number,'')),'[^a-z0-9]','','g') like '%'||q.compact_query||'%'
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and p.part_number is not null and q.compact_query<>'' and regexp_replace(lower(coalesce(p.part_number,'')),'[^a-z0-9]','','g') like '%'||q.compact_query||'%'
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and p.gearbox_code is not null and lower(coalesce(p.gearbox_code,'')) like '%'||q.lower_query||'%'
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and p.gearbox_family is not null and lower(coalesce(p.gearbox_family,'')) like '%'||q.lower_query||'%'
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and p.category_id in (select category_id from category_search where lower(searchable) like '%'||q.lower_query||'%')
 ),
 documents as (
  select
   p.id,
   p.created_at,
   p.seller_id,p.price_pence,p.delivery_days_min,p.warranty_days,
   p.title,
   p.description,
   p.manufacturer,
   p.part_number,
   p.oem_number,
   p.gearbox_family,
   p.gearbox_code,
   leaf.name category_name,
   pg_catalog.lower(c.searchable) category_text,
   pg_catalog.lower(
    pg_catalog.concat_ws(
     ' ',
     p.title,
     p.description,
     p.manufacturer,
     p.part_number,
     p.oem_number,
     p.gearbox_family,
     p.gearbox_code
    )
   ) search_text,
   p.search_document search_vector
  from candidate_ids candidate
  join public.parts p on p.id=candidate.id
  join public.categories leaf on leaf.id=p.category_id
  join category_search c on c.category_id=p.category_id
 ),
 ranked as (
  select
   d.id part_id,
   d.created_at,
   d.seller_id,d.price_pence,d.delivery_days_min,d.warranty_days,
   greatest(
    case
     when q.compact_query<>''
      and pg_catalog.regexp_replace(
       pg_catalog.lower(coalesce(d.oem_number,'')),
       '[^a-z0-9]',
       '',
       'g'
      )=q.compact_query
     then 140 else 0
    end,
    case
     when q.compact_query<>''
      and pg_catalog.regexp_replace(
       pg_catalog.lower(coalesce(d.part_number,'')),
       '[^a-z0-9]',
       '',
       'g'
      )=q.compact_query
     then 135 else 0
    end,
    case when pg_catalog.lower(d.title)=q.lower_query then 130 else 0 end,
    case when pg_catalog.lower(d.title) like q.lower_query||'%' then 120 else 0 end,
    case when pg_catalog.lower(d.category_name)=q.lower_query then 110 else 0 end,
    case when pg_catalog.lower(coalesce(d.manufacturer,''))=q.lower_query then 105 else 0 end,
    case
     when q.compact_query<>''
      and pg_catalog.strpos(
       pg_catalog.regexp_replace(
        pg_catalog.lower(pg_catalog.concat_ws(' ',d.oem_number,d.part_number)),
        '[^a-z0-9]',
        '',
        'g'
       ),
       q.compact_query
      )>0
     then 95 else 0
    end,
    case when pg_catalog.lower(d.title) like '%'||q.lower_query||'%' then 90 else 0 end,
    case when d.category_text like '%'||q.lower_query||'%' then 80 else 0 end,
    case when pg_catalog.lower(coalesce(d.manufacturer,'')) like '%'||q.lower_query||'%' then 75 else 0 end,
    case when d.search_text like '%'||q.lower_query||'%' then 65 else 0 end,
    case
     when d.search_vector@@q.ts_query
     then 50+pg_catalog.floor(pg_catalog.ts_rank(d.search_vector,q.ts_query)*20)::integer
     else 0
    end
   ) search_rank
  from documents d
  cross join prepared_query q
  where q.raw_query<>''
 ),
selected as (
    select v.provider,v.make,v.model_family,v.body_type
    from public.vehicle_catalogue_variants v
    where v.id=p_variant_id
  ),
  exact_matches as (
    select f.part_id,'confirmed'::text as confidence,4 as confidence_rank
    from public.part_catalogue_fitments f
    where f.variant_id=p_variant_id
      and f.part_id in (select ranked.part_id from ranked)
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
    from private.valid_verified_fit_feedback f
    where f.variant_id=p_variant_id
      and f.year=p_year
      and f.part_id in (select ranked.part_id from ranked)
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
    where f.part_id in (select ranked.part_id from ranked)
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
     and p.id in (select ranked.part_id from ranked)
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

 legacy_target as (select v.* from public.vehicles v where p_variant_id is null and v.id=p_vehicle_id),
 legacy_matches as (
  select f.part_id,'confirmed'::text confidence,4 confidence_rank from public.part_fitments f
  where p_variant_id is null and f.vehicle_id=p_vehicle_id and f.part_id in (select ranked.part_id from ranked)
  union all
  select f.part_id,'family_match'::text,2 from legacy_target t
  join public.vehicles s on s.make=t.make and s.model=t.model and s.generation=t.generation
   and s.year=t.year and s.engine=t.engine and s.fuel_type is not distinct from t.fuel_type and s.id<>p_vehicle_id
  join public.part_fitments f on f.vehicle_id=s.id where f.part_id in (select ranked.part_id from ranked)
 ),
 compatibility as (
  select distinct on (c.part_id) c.part_id,c.confidence,c.confidence_rank from (
   select * from exact_matches union all select * from buyer_verified_matches union all
   select * from family_matches union all select * from donor_matches union all select * from legacy_matches
  ) c order by c.part_id,c.confidence_rank desc
 ),
 filtered as materialized (
  select r.*,case when p_variant_id is null and p_vehicle_id is null then null else coalesce(c.confidence,'unverified') end confidence,
   coalesce(c.confidence_rank,0) confidence_rank
  from ranked r left join compatibility c on c.part_id=r.part_id
  where not coalesce(p_compatible_only,true) or (p_variant_id is null and p_vehicle_id is null) or c.part_id is not null
 ),
 seller_distances as materialized (
  select s.id, s.postcode_geocode_approximate,
   case when s.latitude is null or s.longitude is null then null else
    3958.7613*2*asin(least(1.0,sqrt(power(sin(radians(s.latitude-p_buyer_lat)/2),2)+cos(radians(p_buyer_lat))*cos(radians(s.latitude))*power(sin(radians(s.longitude-p_buyer_lon)/2),2)))) end miles
  from public.sellers s where p_sort='distance' and s.id in (select f.seller_id from filtered f)
 )
 select f.part_id,f.confidence,d.miles,coalesce(d.postcode_geocode_approximate,false)
 from filtered f left join seller_distances d on d.id=f.seller_id
 order by
  case when p_sort='price_asc' then f.price_pence end asc nulls last,
  case when p_sort='price_desc' then f.price_pence end desc nulls last,
  case when p_sort='delivery' then f.delivery_days_min end asc nulls last,
  case when p_sort='warranty' then f.warranty_days end desc nulls last,
  case when p_sort='distance' then d.miles end asc nulls last,
  f.confidence_rank desc,f.search_rank desc,f.created_at desc,f.part_id
 limit greatest(1,least(coalesce(p_limit,24),60))+1 offset greatest(0,coalesce(p_offset,0));
end;
$$;
revoke all on function public.marketplace_search_page_v1(text,text,uuid[],text,integer,integer,boolean,uuid,smallint,text,integer,uuid,boolean,double precision,double precision,uuid[],integer,integer) from public;
grant execute on function public.marketplace_search_page_v1(text,text,uuid[],text,integer,integer,boolean,uuid,smallint,text,integer,uuid,boolean,double precision,double precision,uuid[],integer,integer) to anon,authenticated;
