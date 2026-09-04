create index if not exists vehicle_catalogue_selector_v2_idx
  on public.vehicle_catalogue_variants(provider, body_type, make, model_family, id);

create or replace function public.vehicle_catalogue_model_map()
returns table(make text, model_family text)
language sql
stable
security invoker
set search_path=public
as $$
  select distinct v.make, v.model_family
  from public.vehicle_catalogue_variants v
  where v.provider='dft' and v.body_type='Cars'
  order by v.make, v.model_family;
$$;

create or replace function public.vehicle_catalogue_years_for_model(p_make text, p_model text)
returns table(year_first_used smallint)
language sql
stable
security invoker
set search_path=public
as $$
  select distinct y.year_first_used
  from public.vehicle_catalogue_variants v
  join public.vehicle_catalogue_years y on y.variant_id=v.id
  where v.provider='dft'
    and v.body_type='Cars'
    and v.make=p_make
    and v.model_family=p_model
  order by y.year_first_used desc;
$$;

create or replace function public.vehicle_catalogue_variants_for_model_year(
  p_make text,
  p_model text,
  p_year smallint
)
returns table(id uuid, variant text)
language sql
stable
security invoker
set search_path=public
as $$
  select distinct v.id, v.variant
  from public.vehicle_catalogue_variants v
  join public.vehicle_catalogue_years y on y.variant_id=v.id
  where v.provider='dft'
    and v.body_type='Cars'
    and v.make=p_make
    and v.model_family=p_model
    and y.year_first_used=p_year
  order by v.variant;
$$;

revoke all on function public.vehicle_catalogue_model_map() from public;
revoke all on function public.vehicle_catalogue_years_for_model(text,text) from public;
revoke all on function public.vehicle_catalogue_variants_for_model_year(text,text,smallint) from public;

grant execute on function public.vehicle_catalogue_model_map() to anon,authenticated;
grant execute on function public.vehicle_catalogue_years_for_model(text,text) to anon,authenticated;
grant execute on function public.vehicle_catalogue_variants_for_model_year(text,text,smallint) to anon,authenticated;
