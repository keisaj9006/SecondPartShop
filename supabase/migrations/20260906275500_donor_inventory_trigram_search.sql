create index if not exists donor_vehicles_registration_trgm_idx
  on public.donor_vehicles using gin (lower(coalesce(registration,'')) extensions.gin_trgm_ops);

create index if not exists donor_vehicles_make_trgm_idx
  on public.donor_vehicles using gin (lower(make) extensions.gin_trgm_ops);

create index if not exists donor_vehicles_model_trgm_idx
  on public.donor_vehicles using gin (lower(model) extensions.gin_trgm_ops);

create index if not exists donor_vehicles_variant_trgm_idx
  on public.donor_vehicles using gin (lower(coalesce(variant,'')) extensions.gin_trgm_ops);
