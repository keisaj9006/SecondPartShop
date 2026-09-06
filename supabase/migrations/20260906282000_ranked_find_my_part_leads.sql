-- Rank Find My Part requests for each seller instead of broadcasting every
-- open request to the whole seller network.

create index if not exists part_requests_open_category_created_idx
  on public.part_requests(category_id,created_at desc)
  where status='open';

create index if not exists part_requests_open_variant_created_idx
  on public.part_requests(catalogue_variant_id,created_at desc)
  where status='open';

create index if not exists part_requests_open_oem_compact_idx
  on public.part_requests(
    (regexp_replace(lower(coalesce(oem_number,'')),'[^a-z0-9]','','g'))
  )
  where status='open' and oem_number is not null;

create or replace function public.seller_ranked_part_request_leads(
  p_limit integer default 30,
  p_offset integer default 0
)
returns table(
  request_id uuid,
  query_text text,
  oem_number text,
  notes text,
  created_at timestamptz,
  category_id uuid,
  category_name text,
  catalogue_variant_id uuid,
  vehicle_make text,
  vehicle_model text,
  vehicle_variant text,
  year smallint,
  fuel_type text,
  engine_size_simple integer,
  match_score integer,
  match_reasons text[]
)
language sql
stable
security definer
set search_path=''
as $$
  with current_seller as (
    select s.id
    from public.sellers s
    where s.owner_id=auth.uid()
    limit 1
  ),
  open_requests as (
    select
      r.id,
      r.query_text,
      r.oem_number,
      r.notes,
      r.created_at,
      r.category_id,
      c.name as category_name,
      r.catalogue_variant_id,
      v.make as vehicle_make,
      v.model_family as vehicle_model,
      v.variant as vehicle_variant,
      r.year,
      r.fuel_type,
      r.engine_size_simple
    from public.part_requests r
    left join public.categories c on c.id=r.category_id
    left join public.vehicle_catalogue_variants v on v.id=r.catalogue_variant_id
    where r.status='open'
  ),
  scored as (
    select
      r.*,
      (
        case when exists(
          select 1
          from current_seller cs
          join public.parts p on p.seller_id=cs.id
          where p.status in ('draft','active')
            and r.oem_number is not null
            and p.oem_number is not null
            and regexp_replace(lower(p.oem_number),'[^a-z0-9]','','g')
                =regexp_replace(lower(r.oem_number),'[^a-z0-9]','','g')
        ) then 120 else 0 end
        +
        case when exists(
          select 1
          from current_seller cs
          join public.parts p on p.seller_id=cs.id
          join public.part_catalogue_fitments f on f.part_id=p.id
          where p.status in ('draft','active')
            and r.catalogue_variant_id is not null
            and f.variant_id=r.catalogue_variant_id
            and (r.year is null or f.year_from is null or r.year>=f.year_from)
            and (r.year is null or f.year_to is null or r.year<=f.year_to)
            and (r.fuel_type is null or f.fuel_type is null or upper(f.fuel_type)=upper(r.fuel_type))
            and (r.engine_size_simple is null or f.engine_size_simple is null or f.engine_size_simple=r.engine_size_simple)
        ) then 90 else 0 end
        +
        case when exists(
          select 1
          from current_seller cs
          join public.donor_vehicles d on d.seller_id=cs.id
          where r.vehicle_make is not null
            and r.vehicle_model is not null
            and regexp_replace(lower(d.make),'[^a-z0-9]','','g')
                =regexp_replace(lower(r.vehicle_make),'[^a-z0-9]','','g')
            and regexp_replace(lower(d.model),'[^a-z0-9]','','g')
                =regexp_replace(lower(r.vehicle_model),'[^a-z0-9]','','g')
            and (r.year is null or d.year=r.year)
            and (r.fuel_type is null or d.fuel_type is null or upper(d.fuel_type)=upper(r.fuel_type))
            and (r.engine_size_simple is null or d.engine_size_simple is null or d.engine_size_simple=r.engine_size_simple)
        ) then 60 else 0 end
        +
        case when exists(
          select 1
          from current_seller cs
          join public.parts p on p.seller_id=cs.id
          where p.status in ('draft','active')
            and r.category_id is not null
            and p.category_id=r.category_id
        ) then 35 else 0 end
        +
        case when exists(
          select 1
          from current_seller cs
          join public.parts p on p.seller_id=cs.id
          where p.status in ('draft','active')
            and (
              lower(p.title) like '%'||lower(r.query_text)||'%'
              or lower(r.query_text) like '%'||lower(p.title)||'%'
              or (p.manufacturer is not null and lower(r.query_text) like '%'||lower(p.manufacturer)||'%')
              or (p.part_number is not null and lower(r.query_text) like '%'||lower(p.part_number)||'%')
              or (p.oem_number is not null and lower(r.query_text) like '%'||lower(p.oem_number)||'%')
            )
        ) then 25 else 0 end
      )::integer as match_score,
      array_remove(array[
        case when exists(
          select 1
          from current_seller cs
          join public.parts p on p.seller_id=cs.id
          where p.status in ('draft','active')
            and r.oem_number is not null
            and p.oem_number is not null
            and regexp_replace(lower(p.oem_number),'[^a-z0-9]','','g')
                =regexp_replace(lower(r.oem_number),'[^a-z0-9]','','g')
        ) then 'Exact OE/OEM match in your inventory' end,
        case when exists(
          select 1
          from current_seller cs
          join public.parts p on p.seller_id=cs.id
          join public.part_catalogue_fitments f on f.part_id=p.id
          where p.status in ('draft','active')
            and r.catalogue_variant_id is not null
            and f.variant_id=r.catalogue_variant_id
            and (r.year is null or f.year_from is null or r.year>=f.year_from)
            and (r.year is null or f.year_to is null or r.year<=f.year_to)
            and (r.fuel_type is null or f.fuel_type is null or upper(f.fuel_type)=upper(r.fuel_type))
            and (r.engine_size_simple is null or f.engine_size_simple is null or f.engine_size_simple=r.engine_size_simple)
        ) then 'Exact vehicle fitment in your inventory' end,
        case when exists(
          select 1
          from current_seller cs
          join public.donor_vehicles d on d.seller_id=cs.id
          where r.vehicle_make is not null
            and r.vehicle_model is not null
            and regexp_replace(lower(d.make),'[^a-z0-9]','','g')
                =regexp_replace(lower(r.vehicle_make),'[^a-z0-9]','','g')
            and regexp_replace(lower(d.model),'[^a-z0-9]','','g')
                =regexp_replace(lower(r.vehicle_model),'[^a-z0-9]','','g')
            and (r.year is null or d.year=r.year)
            and (r.fuel_type is null or d.fuel_type is null or upper(d.fuel_type)=upper(r.fuel_type))
            and (r.engine_size_simple is null or d.engine_size_simple is null or d.engine_size_simple=r.engine_size_simple)
        ) then 'Matching donor vehicle in your stock' end,
        case when exists(
          select 1
          from current_seller cs
          join public.parts p on p.seller_id=cs.id
          where p.status in ('draft','active')
            and r.category_id is not null
            and p.category_id=r.category_id
        ) then 'You already stock this part category' end,
        case when exists(
          select 1
          from current_seller cs
          join public.parts p on p.seller_id=cs.id
          where p.status in ('draft','active')
            and (
              lower(p.title) like '%'||lower(r.query_text)||'%'
              or lower(r.query_text) like '%'||lower(p.title)||'%'
              or (p.manufacturer is not null and lower(r.query_text) like '%'||lower(p.manufacturer)||'%')
              or (p.part_number is not null and lower(r.query_text) like '%'||lower(p.part_number)||'%')
              or (p.oem_number is not null and lower(r.query_text) like '%'||lower(p.oem_number)||'%')
            )
        ) then 'Request text matches your inventory' end
      ],null)::text[] as match_reasons
    from open_requests r
  )
  select
    s.id,
    s.query_text,
    s.oem_number,
    s.notes,
    s.created_at,
    s.category_id,
    s.category_name,
    s.catalogue_variant_id,
    s.vehicle_make,
    s.vehicle_model,
    s.vehicle_variant,
    s.year,
    s.fuel_type,
    s.engine_size_simple,
    s.match_score,
    s.match_reasons
  from scored s
  where s.match_score>0
  order by s.match_score desc,s.created_at desc,s.id
  limit greatest(1,least(coalesce(p_limit,30),60))+1
  offset greatest(0,coalesce(p_offset,0));
$$;

revoke all on function public.seller_ranked_part_request_leads(integer,integer) from public;
grant execute on function public.seller_ranked_part_request_leads(integer,integer) to authenticated;
