create or replace function public.seller_open_part_request_leads()
returns table(
  id uuid,
  query_text text,
  oem_number text,
  notes text,
  created_at timestamptz,
  category_id uuid,
  category_name text,
  variant_id uuid,
  vehicle_make text,
  vehicle_model text,
  vehicle_variant text,
  year smallint,
  fuel_type text,
  engine_size_simple integer
)
language plpgsql
security definer
set search_path=''
as $$
begin
  if not (
    exists (
      select 1
      from public.sellers s
      where s.owner_id=(select auth.uid())
    )
    or private.is_admin()
  ) then
    raise exception 'Seller access required.';
  end if;

  return query
  select
    r.id,
    r.query_text,
    r.oem_number,
    r.notes,
    r.created_at,
    r.category_id,
    c.name,
    r.catalogue_variant_id,
    v.make,
    v.model_family,
    v.variant,
    r.year,
    r.fuel_type,
    r.engine_size_simple
  from public.part_requests r
  left join public.categories c on c.id=r.category_id
  left join public.vehicle_catalogue_variants v on v.id=r.catalogue_variant_id
  where r.status='open'
  order by r.created_at desc;
end;
$$;

revoke all on function public.seller_open_part_request_leads() from public;
grant execute on function public.seller_open_part_request_leads() to authenticated;
