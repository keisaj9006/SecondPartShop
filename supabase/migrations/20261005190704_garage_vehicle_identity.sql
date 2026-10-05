-- Forward/corrective recovery only: preserve identity-only rows. Never restore
-- the old required-variant constraint or delete/merge rows to satisfy it.
-- STOP before hosted deployment if this database also serves Production.
-- Review collision counts immediately before deployment; this lock makes the
-- prerequisite check and index creation one serialized migration operation.
lock table public.garage_vehicles in share row exclusive mode;
do $$
begin
  if exists (
    select 1 from public.garage_vehicles
    where registration is not null
    group by profile_id,upper(regexp_replace(registration,'[[:space:]]','','g'))
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
  on public.garage_vehicles(profile_id,upper(regexp_replace(registration,'[[:space:]]','','g')))
  where registration is not null;

comment on column public.garage_vehicles.identity_make is
  'Bounded identity snapshot; vehicle existence is not exact-fit evidence.';
comment on column public.garage_vehicles.identity_model is
  'Identity model for vehicles without an exact catalogue derivative.';
