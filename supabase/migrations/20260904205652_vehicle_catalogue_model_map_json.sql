create or replace function public.vehicle_catalogue_model_map_json()
returns jsonb
language sql
stable
security invoker
set search_path=public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('make', q.make, 'modelFamily', q.model_family)
      order by q.make, q.model_family
    ),
    '[]'::jsonb
  )
  from (
    select distinct v.make, v.model_family
    from public.vehicle_catalogue_variants v
    where v.provider='dft' and v.body_type='Cars'
  ) q;
$$;

revoke all on function public.vehicle_catalogue_model_map_json() from public;
grant execute on function public.vehicle_catalogue_model_map_json() to anon,authenticated;
