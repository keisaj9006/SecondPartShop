create or replace function public.seller_part_request_lead(p_request_id uuid)
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
    where s.owner_id=(select auth.uid())
    limit 1
  )
  select
    l.request_id,
    l.query_text,
    l.oem_number,
    l.notes,
    l.created_at,
    l.category_id,
    c.name,
    l.catalogue_variant_id,
    v.make,
    v.model_family,
    v.variant,
    l.year,
    l.fuel_type,
    l.engine_size_simple,
    m.match_score,
    m.match_reasons
  from current_seller cs
  join public.seller_part_request_matches m
    on m.seller_id=cs.id
   and m.request_id=p_request_id
   and m.status='open'
  join public.seller_part_request_leads l
    on l.request_id=m.request_id
   and l.status='open'
  left join public.categories c on c.id=l.category_id
  left join public.vehicle_catalogue_variants v on v.id=l.catalogue_variant_id
  limit 1;
$$;

revoke all on function public.seller_part_request_lead(uuid) from public;
revoke execute on function public.seller_part_request_lead(uuid) from anon;
grant execute on function public.seller_part_request_lead(uuid) to authenticated;
