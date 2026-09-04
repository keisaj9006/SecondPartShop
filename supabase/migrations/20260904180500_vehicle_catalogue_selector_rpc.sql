create or replace function public.vehicle_catalogue_makes()
returns table(make text)
language sql
stable
security invoker
set search_path=public
as $$
  select distinct v.make
  from public.vehicle_catalogue_variants v
  where v.provider='dft' and v.body_type='Cars'
  order by v.make;
$$;

create or replace function public.vehicle_catalogue_models(p_make text)
returns table(model_family text)
language sql
stable
security invoker
set search_path=public
as $$
  select distinct v.model_family
  from public.vehicle_catalogue_variants v
  where v.provider='dft' and v.body_type='Cars' and v.make=p_make
  order by v.model_family;
$$;

revoke all on function public.vehicle_catalogue_makes() from public;
revoke all on function public.vehicle_catalogue_models(text) from public;
grant execute on function public.vehicle_catalogue_makes() to anon,authenticated;
grant execute on function public.vehicle_catalogue_models(text) to anon,authenticated;
