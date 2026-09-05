create or replace function public.import_vehicle_catalogue_batch(
  p_provider text,
  p_variants jsonb default '[]'::jsonb,
  p_years jsonb default '[]'::jsonb,
  p_engines jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variant_count integer := 0;
  v_year_count integer := 0;
  v_engine_count integer := 0;
begin
  if p_provider is null or btrim(p_provider) = '' then
    raise exception 'provider is required';
  end if;
  if jsonb_typeof(p_variants) <> 'array' or jsonb_typeof(p_years) <> 'array' or jsonb_typeof(p_engines) <> 'array' then
    raise exception 'batch payloads must be arrays';
  end if;

  insert into public.vehicle_catalogue_variants(
    provider,provider_key,make,model_family,variant,body_type,
    data_status,source_reference,source_updated_at,updated_at
  )
  select
    p_provider,x.provider_key,x.make,x.model_family,x.variant,nullif(x.body_type,''),
    'external_import'::public.vehicle_data_status,x.source_reference,x.source_updated_at,now()
  from jsonb_to_recordset(p_variants) as x(
    provider_key text,make text,model_family text,variant text,body_type text,
    source_reference text,source_updated_at date
  )
  where x.provider_key is not null and x.make is not null and x.model_family is not null
    and x.variant is not null and x.source_reference is not null
  on conflict(provider,provider_key) do update set
    make=excluded.make,model_family=excluded.model_family,variant=excluded.variant,
    body_type=excluded.body_type,data_status=excluded.data_status,
    source_reference=excluded.source_reference,source_updated_at=excluded.source_updated_at,
    updated_at=now();
  get diagnostics v_variant_count = row_count;

  insert into public.vehicle_catalogue_years(variant_id,year_first_used,source_reference)
  select v.id,y.year_first_used,y.source_reference
  from jsonb_to_recordset(p_years) as y(provider_key text,year_first_used smallint,source_reference text)
  join public.vehicle_catalogue_variants v on v.provider=p_provider and v.provider_key=y.provider_key
  where y.year_first_used between 1900 and 2100 and y.source_reference is not null
  on conflict(variant_id,year_first_used) do update set source_reference=excluded.source_reference;
  get diagnostics v_year_count = row_count;

  insert into public.vehicle_catalogue_engines(
    variant_id,fuel_type,engine_size_simple,engine_size_desc,source_reference
  )
  select v.id,e.fuel_type,e.engine_size_simple,nullif(e.engine_size_desc,''),e.source_reference
  from jsonb_to_recordset(p_engines) as e(
    provider_key text,fuel_type text,engine_size_simple integer,engine_size_desc text,source_reference text
  )
  join public.vehicle_catalogue_variants v on v.provider=p_provider and v.provider_key=e.provider_key
  where e.fuel_type is not null and e.source_reference is not null
  on conflict(variant_id,fuel_type,engine_size_simple,engine_size_desc) do update set
    source_reference=excluded.source_reference;
  get diagnostics v_engine_count = row_count;

  return jsonb_build_object('variants',v_variant_count,'years',v_year_count,'engines',v_engine_count);
end;
$$;

revoke all on function public.import_vehicle_catalogue_batch(text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.import_vehicle_catalogue_batch(text,jsonb,jsonb,jsonb) to service_role;
