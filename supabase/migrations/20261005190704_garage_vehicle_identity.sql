-- Forward/corrective recovery only: preserve identity-only rows. Never restore
-- the old required-variant constraint or delete/merge rows to satisfy it.
-- STOP before hosted deployment if this database also serves Production.
-- Review collision counts immediately before deployment; this lock makes the
-- prerequisite check and index creation one serialized migration operation.
-- Registration patterns below use the complete ECMAScript whitespace set,
-- matching normalizeRegistration; POSIX space misses NBSP and the BOM.
lock table public.garage_vehicles in share row exclusive mode;
do $$
begin
  if exists (
    select 1 from public.garage_vehicles
    where registration is not null
    group by profile_id,upper(regexp_replace(registration,U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]','','g'))
    having count(*)>1
  ) then
    raise exception 'Garage registration collisions require an explicit corrective migration before deployment; no rows have been removed';
  end if;
end $$;

alter table public.garage_vehicles
  alter column catalogue_variant_id drop not null,
  add column identity_make text,
  add column identity_model text,
  add constraint garage_vehicle_identity_make_bound
    check (identity_make is null or char_length(btrim(identity_make)) between 1 and 80),
  add constraint garage_vehicle_identity_model_bound
    check (identity_model is null or char_length(btrim(identity_model)) between 1 and 120),
  add constraint garage_vehicle_fuel_bound
    check (fuel_type is null or char_length(btrim(fuel_type)) between 1 and 80),
  add constraint garage_vehicle_identity_required
    check (catalogue_variant_id is not null or
      (registration is not null and registration ~ '[A-Z]' and registration ~ '[0-9]'
       and identity_make is not null and identity_model is not null));

-- Keep the existing catalogue foreign key, composite identity index and owner
-- SELECT/INSERT/UPDATE/DELETE policies and grants unchanged.
create unique index garage_vehicles_owner_registration_idx
  on public.garage_vehicles(profile_id,upper(regexp_replace(registration,U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]','','g')))
  where registration is not null;

comment on column public.garage_vehicles.identity_make is
  'Bounded identity snapshot; vehicle existence is not exact-fit evidence.';
comment on column public.garage_vehicles.identity_model is
  'Identity model for vehicles without an exact catalogue derivative.';

create function public.save_garage_vehicle_v1(
 p_operation text,
 p_registration text default null,
 p_make text default null,
 p_model text default null,
 p_year integer default null,
 p_fuel text default null,
 p_engine integer default null,
 p_colour text default null,
 p_nickname text default null,
 p_catalogue_variant_id uuid default null,
 p_garage_vehicle_id uuid default null
) returns table(garage_vehicle_id uuid,outcome text,catalogue_variant_id uuid)
language plpgsql security invoker set search_path=''
as $$
declare
 v_owner uuid := auth.uid();
 v_registration text := nullif(upper(regexp_replace(p_registration,U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]','','g')),'');
 v_make text := nullif(btrim(p_make),'');
 v_model text := nullif(btrim(p_model),'');
 v_fuel text := nullif(btrim(p_fuel),'');
 v_variant public.vehicle_catalogue_variants%rowtype;
 v_existing public.garage_vehicles%rowtype;
 v_created uuid;
 v_key text;
 v_profile_fuel text;
 v_fuel_count integer;
begin
 if v_owner is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_operation is null or p_operation not in ('identity_save','enrich_exact')
    or p_year is null or p_year not between 1900 and 2100
    or v_make is null or char_length(v_make)>80
    or v_model is null or char_length(v_model)>120
    or (v_registration is not null and (v_registration !~ '^[A-Z0-9]{2,8}$' or v_registration !~ '[A-Z]' or v_registration !~ '[0-9]'))
    or (v_fuel is not null and char_length(v_fuel)>80)
    or (p_engine is not null and p_engine not between 100 and 10000)
    or char_length(p_colour)>40 or char_length(p_nickname)>50 then
   raise exception 'Invalid vehicle identity' using errcode='22023';
 end if;
 if p_operation='identity_save' and (v_registration is null or p_catalogue_variant_id is not null or p_garage_vehicle_id is not null) then
   raise exception 'Identity save requires registration and no derivative' using errcode='22023';
 end if;

 -- Exact profile is always explicitly supplied, never the first candidate.
 if p_operation='enrich_exact' then
   if p_catalogue_variant_id is null then
     return query select null::uuid,'reselect_required'::text,null::uuid;return;
   end if;
   select * into v_variant from public.vehicle_catalogue_variants v
    where v.id=p_catalogue_variant_id and v.provider='dft' and v.body_type='Cars';
   if not found or
      btrim(regexp_replace(upper(v_variant.make),'[^A-Z0-9]+',' ','g'))<>btrim(regexp_replace(upper(v_make),'[^A-Z0-9]+',' ','g')) or
      btrim(regexp_replace(upper(v_variant.model_family),'[^A-Z0-9]+',' ','g'))<>btrim(regexp_replace(upper(v_model),'[^A-Z0-9]+',' ','g')) or
      not exists(select 1 from public.vehicle_catalogue_years y where y.variant_id=p_catalogue_variant_id and y.year_first_used=p_year) or
      ((v_fuel is not null or p_engine is not null) and not exists(
        select 1 from public.vehicle_catalogue_engines e where e.variant_id=p_catalogue_variant_id
         and (v_fuel is null or replace(replace(btrim(regexp_replace(upper(e.fuel_type),'[^A-Z0-9]+',' ','g')),'BATTERY ELECTRIC','ELECTRIC'),'HYBRID ELECTRIC','HYBRID')=
             replace(replace(btrim(regexp_replace(upper(v_fuel),'[^A-Z0-9]+',' ','g')),'BATTERY ELECTRIC','ELECTRIC'),'HYBRID ELECTRIC','HYBRID'))
         and (p_engine is null or e.engine_size_simple=p_engine)
      )) then
     return query select null::uuid,'reselect_required'::text,null::uuid;return;
   end if;
   if v_fuel is not null then
     -- Keep an explicitly chosen canonical catalogue label. For an equivalent
     -- provider spelling, canonicalize only when exactly one label remains.
     if exists(select 1 from public.vehicle_catalogue_engines e where e.variant_id=p_catalogue_variant_id and e.fuel_type=v_fuel and (p_engine is null or e.engine_size_simple=p_engine)) then
       v_profile_fuel:=v_fuel;
     else
       select count(distinct e.fuel_type),min(e.fuel_type) into v_fuel_count,v_profile_fuel
       from public.vehicle_catalogue_engines e where e.variant_id=p_catalogue_variant_id
        and replace(replace(btrim(regexp_replace(upper(e.fuel_type),'[^A-Z0-9]+',' ','g')),'BATTERY ELECTRIC','ELECTRIC'),'HYBRID ELECTRIC','HYBRID')=
            replace(replace(btrim(regexp_replace(upper(v_fuel),'[^A-Z0-9]+',' ','g')),'BATTERY ELECTRIC','ELECTRIC'),'HYBRID ELECTRIC','HYBRID')
        and (p_engine is null or e.engine_size_simple=p_engine);
       if v_fuel_count<>1 then return query select null::uuid,'reselect_required'::text,null::uuid;return;end if;
     end if;
   end if;
 end if;

 -- Serialize duplicate creates by owner and normalized registration. Manual
 -- unregistered profiles serialize by the existing composite identity key.
 v_key := v_owner::text||':'||coalesce(v_registration,p_catalogue_variant_id::text||':'||p_year::text||':'||coalesce(v_profile_fuel,v_fuel,'')||':'||coalesce(p_engine::text,''));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key,0));
 if p_garage_vehicle_id is not null then
   select * into v_existing from public.garage_vehicles g
    where g.id=p_garage_vehicle_id and g.profile_id=v_owner for update;
   if not found or (v_registration is not null and v_existing.registration is distinct from v_registration) then
     return query select null::uuid,'reselect_required'::text,null::uuid;return;
   end if;
 else
   select * into v_existing from public.garage_vehicles g where g.profile_id=v_owner
    and ((v_registration is not null and upper(regexp_replace(g.registration,U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]','','g'))=v_registration)
      or (v_registration is null and g.registration is null and g.catalogue_variant_id=p_catalogue_variant_id and g.year=p_year
        and g.fuel_type is not distinct from coalesce(v_profile_fuel,v_fuel) and g.engine_size_simple is not distinct from p_engine)) for update;
 end if;

 if v_existing.id is null then
   insert into public.garage_vehicles(profile_id,catalogue_variant_id,registration,year,fuel_type,engine_size_simple,colour,nickname,identity_make,identity_model)
    values(v_owner,p_catalogue_variant_id,v_registration,p_year,coalesce(v_profile_fuel,v_fuel),p_engine,nullif(btrim(p_colour),''),nullif(btrim(p_nickname),''),v_make,v_model)
    on conflict do nothing returning id into v_created;
   if v_created is not null then
     return query select v_created,'created'::text,p_catalogue_variant_id;return;
   end if;
   -- Also tolerate a competing direct authorized insert at the unique boundary.
   select * into v_existing from public.garage_vehicles g where g.profile_id=v_owner
    and ((v_registration is not null and upper(regexp_replace(g.registration,U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]','','g'))=v_registration)
      or (v_registration is null and g.registration is null and g.catalogue_variant_id=p_catalogue_variant_id and g.year=p_year
        and g.fuel_type is not distinct from coalesce(v_profile_fuel,v_fuel) and g.engine_size_simple is not distinct from p_engine)) for update;
   if not found then raise exception 'Retry Garage save' using errcode='40001';end if;
 end if;

 -- Validate against saved identity, not client identity. Legacy rows resolve
 -- their identity through their existing catalogue relation.
 if v_existing.identity_make is null or v_existing.identity_model is null then
   select v.make,v.model_family into v_existing.identity_make,v_existing.identity_model
     from public.vehicle_catalogue_variants v where v.id=v_existing.catalogue_variant_id;
 end if;
 if btrim(regexp_replace(upper(v_existing.identity_make),'[^A-Z0-9]+',' ','g')) is distinct from btrim(regexp_replace(upper(v_make),'[^A-Z0-9]+',' ','g')) or
    btrim(regexp_replace(upper(v_existing.identity_model),'[^A-Z0-9]+',' ','g')) is distinct from btrim(regexp_replace(upper(v_model),'[^A-Z0-9]+',' ','g')) or
    v_existing.year<>p_year or
    (v_existing.fuel_type is not null and v_fuel is not null and
     replace(replace(btrim(regexp_replace(upper(v_existing.fuel_type),'[^A-Z0-9]+',' ','g')),'BATTERY ELECTRIC','ELECTRIC'),'HYBRID ELECTRIC','HYBRID')<>
     replace(replace(btrim(regexp_replace(upper(v_fuel),'[^A-Z0-9]+',' ','g')),'BATTERY ELECTRIC','ELECTRIC'),'HYBRID ELECTRIC','HYBRID')) or
    (v_existing.engine_size_simple is not null and p_engine is not null and v_existing.engine_size_simple<>p_engine) then
   return query select v_existing.id,'reselect_required'::text,v_existing.catalogue_variant_id;return;
 end if;
 if p_operation='enrich_exact' and v_existing.catalogue_variant_id is not null and v_existing.catalogue_variant_id<>p_catalogue_variant_id then
   return query select v_existing.id,'reselect_required'::text,v_existing.catalogue_variant_id;return;
 end if;
 -- An omitted optional value cannot sidestep reliable saved fuel/capacity.
 if p_operation='enrich_exact' and (v_existing.fuel_type is not null or v_existing.engine_size_simple is not null) and not exists(
   select 1 from public.vehicle_catalogue_engines e where e.variant_id=p_catalogue_variant_id
    and (v_existing.fuel_type is null or
     replace(replace(btrim(regexp_replace(upper(e.fuel_type),'[^A-Z0-9]+',' ','g')),'BATTERY ELECTRIC','ELECTRIC'),'HYBRID ELECTRIC','HYBRID')=
     replace(replace(btrim(regexp_replace(upper(v_existing.fuel_type),'[^A-Z0-9]+',' ','g')),'BATTERY ELECTRIC','ELECTRIC'),'HYBRID ELECTRIC','HYBRID'))
    and (v_existing.engine_size_simple is null or e.engine_size_simple=v_existing.engine_size_simple)
 ) then
   return query select v_existing.id,'reselect_required'::text,v_existing.catalogue_variant_id;return;
 end if;

 if p_operation='enrich_exact' and v_profile_fuel is null and v_existing.fuel_type is not null then
   select count(distinct e.fuel_type),min(e.fuel_type) into v_fuel_count,v_profile_fuel
   from public.vehicle_catalogue_engines e where e.variant_id=p_catalogue_variant_id
    and replace(replace(btrim(regexp_replace(upper(e.fuel_type),'[^A-Z0-9]+',' ','g')),'BATTERY ELECTRIC','ELECTRIC'),'HYBRID ELECTRIC','HYBRID')=
        replace(replace(btrim(regexp_replace(upper(v_existing.fuel_type),'[^A-Z0-9]+',' ','g')),'BATTERY ELECTRIC','ELECTRIC'),'HYBRID ELECTRIC','HYBRID')
    and (coalesce(v_existing.engine_size_simple,p_engine) is null or e.engine_size_simple=coalesce(v_existing.engine_size_simple,p_engine));
   if v_fuel_count<>1 then return query select v_existing.id,'reselect_required'::text,v_existing.catalogue_variant_id;return;end if;
 end if;
 update public.garage_vehicles g set
  catalogue_variant_id=coalesce(g.catalogue_variant_id,p_catalogue_variant_id),
  identity_make=coalesce(g.identity_make,v_make),identity_model=coalesce(g.identity_model,v_model),
  fuel_type=case when p_operation='enrich_exact' then coalesce(v_profile_fuel,g.fuel_type,v_fuel) else coalesce(g.fuel_type,v_fuel) end,
  engine_size_simple=coalesce(g.engine_size_simple,p_engine),
  colour=coalesce(g.colour,nullif(btrim(p_colour),'')),nickname=coalesce(g.nickname,nullif(btrim(p_nickname),'')),updated_at=now()
  where g.id=v_existing.id and g.profile_id=v_owner;
 return query select v_existing.id,
  case when p_operation='enrich_exact' and v_existing.catalogue_variant_id is null then 'enriched' else 'already_exists' end,
  coalesce(v_existing.catalogue_variant_id,p_catalogue_variant_id);
end $$;

revoke all on function public.save_garage_vehicle_v1(text,text,text,text,integer,text,integer,text,text,uuid,uuid) from public,anon;
grant execute on function public.save_garage_vehicle_v1(text,text,text,text,integer,text,integer,text,text,uuid,uuid) to authenticated;
