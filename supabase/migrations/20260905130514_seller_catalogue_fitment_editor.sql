create or replace function public.replace_part_catalogue_fitments(
  p_part_id uuid,
  p_fitments jsonb
)
returns void
language plpgsql
security invoker
set search_path=''
as $$
declare
  inserted_count integer;
begin
  if jsonb_typeof(p_fitments) is distinct from 'array' then
    raise exception 'Fitments must be a JSON array.';
  end if;

  if jsonb_array_length(p_fitments) > 20 then
    raise exception 'A listing can have at most 20 catalogue fitments.';
  end if;

  if not (private.owns_part(p_part_id) or private.is_admin()) then
    raise exception 'Not allowed to edit catalogue fitments.';
  end if;

  delete from public.part_catalogue_fitments
  where part_id = p_part_id;

  if jsonb_array_length(p_fitments) = 0 then
    return;
  end if;

  insert into public.part_catalogue_fitments(
    part_id,
    variant_id,
    year_from,
    year_to,
    fuel_type,
    engine_size_simple,
    notes
  )
  select
    p_part_id,
    x.variant_id,
    x.year_value,
    x.year_value,
    nullif(x.fuel_type,''),
    x.engine_size_simple,
    nullif(x.notes,'')
  from jsonb_to_recordset(p_fitments) as x(
    variant_id uuid,
    year_value smallint,
    fuel_type text,
    engine_size_simple integer,
    notes text
  )
  join public.vehicle_catalogue_variants v
    on v.id=x.variant_id
   and v.provider='dft'
   and v.body_type='Cars'
  join public.vehicle_catalogue_years y
    on y.variant_id=x.variant_id
   and y.year_first_used=x.year_value
  where
    (
      x.fuel_type is null
      and x.engine_size_simple is null
    )
    or exists (
      select 1
      from public.vehicle_catalogue_engines e
      where e.variant_id=x.variant_id
        and e.fuel_type=x.fuel_type
        and (
          x.engine_size_simple is null
          or e.engine_size_simple=x.engine_size_simple
        )
    );

  get diagnostics inserted_count = row_count;

  if inserted_count <> jsonb_array_length(p_fitments) then
    raise exception 'One or more vehicle fitments are invalid or not in the current catalogue.';
  end if;
end;
$$;

revoke all on function public.replace_part_catalogue_fitments(uuid,jsonb) from public;
grant execute on function public.replace_part_catalogue_fitments(uuid,jsonb) to authenticated;
