create or replace function public.buyer_part_request_match_counts()
returns table(
  request_id uuid,
  matching_seller_count integer,
  verified_seller_count integer
)
language sql
stable
security definer
set search_path=''
as $$
  with own_requests as (
    select
      r.id,
      r.query_text,
      r.oem_number,
      r.category_id,
      r.catalogue_variant_id,
      r.year,
      r.fuel_type,
      r.engine_size_simple,
      v.make as vehicle_make,
      v.model_family as vehicle_model
    from public.part_requests r
    left join public.vehicle_catalogue_variants v on v.id=r.catalogue_variant_id
    where r.profile_id=auth.uid()
      and r.status='open'
  ),
  matched as (
    select
      r.id as request_id,
      s.id as seller_id,
      (s.verified_at is not null) as seller_verified
    from own_requests r
    join public.sellers s on (
      exists(
        select 1
        from public.parts p
        where p.seller_id=s.id
          and p.status in ('draft','active')
          and r.oem_number is not null
          and p.oem_number is not null
          and regexp_replace(lower(p.oem_number),'[^a-z0-9]','','g')
              =regexp_replace(lower(r.oem_number),'[^a-z0-9]','','g')
      )
      or exists(
        select 1
        from public.parts p
        join public.part_catalogue_fitments f on f.part_id=p.id
        where p.seller_id=s.id
          and p.status in ('draft','active')
          and r.catalogue_variant_id is not null
          and f.variant_id=r.catalogue_variant_id
          and (r.year is null or f.year_from is null or r.year>=f.year_from)
          and (r.year is null or f.year_to is null or r.year<=f.year_to)
          and (r.fuel_type is null or f.fuel_type is null or upper(f.fuel_type)=upper(r.fuel_type))
          and (r.engine_size_simple is null or f.engine_size_simple is null or f.engine_size_simple=r.engine_size_simple)
      )
      or exists(
        select 1
        from public.donor_vehicles d
        where d.seller_id=s.id
          and r.vehicle_make is not null
          and r.vehicle_model is not null
          and regexp_replace(lower(d.make),'[^a-z0-9]','','g')
              =regexp_replace(lower(r.vehicle_make),'[^a-z0-9]','','g')
          and regexp_replace(lower(d.model),'[^a-z0-9]','','g')
              =regexp_replace(lower(r.vehicle_model),'[^a-z0-9]','','g')
          and (r.year is null or d.year=r.year)
          and (r.fuel_type is null or d.fuel_type is null or upper(d.fuel_type)=upper(r.fuel_type))
          and (r.engine_size_simple is null or d.engine_size_simple is null or d.engine_size_simple=r.engine_size_simple)
      )
      or exists(
        select 1
        from public.parts p
        where p.seller_id=s.id
          and p.status in ('draft','active')
          and r.category_id is not null
          and p.category_id=r.category_id
      )
      or exists(
        select 1
        from public.parts p
        where p.seller_id=s.id
          and p.status in ('draft','active')
          and (
            lower(p.title) like '%'||lower(r.query_text)||'%'
            or lower(r.query_text) like '%'||lower(p.title)||'%'
            or (p.manufacturer is not null and lower(r.query_text) like '%'||lower(p.manufacturer)||'%')
            or (p.part_number is not null and lower(r.query_text) like '%'||lower(p.part_number)||'%')
            or (p.oem_number is not null and lower(r.query_text) like '%'||lower(p.oem_number)||'%')
          )
      )
    )
  )
  select
    r.id,
    count(distinct m.seller_id)::integer,
    count(distinct m.seller_id) filter(where m.seller_verified)::integer
  from own_requests r
  left join matched m on m.request_id=r.id
  group by r.id;
$$;

revoke all on function public.buyer_part_request_match_counts() from public;
grant execute on function public.buyer_part_request_match_counts() to authenticated;
