create table public.vehicle_catalogue_variants (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_key text not null,
  make text not null,
  model_family text not null,
  variant text not null,
  body_type text,
  data_status public.vehicle_data_status not null default 'external_import',
  source_reference text not null,
  source_updated_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_key)
);

comment on table public.vehicle_catalogue_variants is
  'Provider-neutral vehicle model catalogue. DfT/DVLA statistical imports live here without registration numbers.';
comment on column public.vehicle_catalogue_variants.provider_key is
  'Deterministic provider-specific key derived from non-sensitive vehicle catalogue fields.';
comment on column public.vehicle_catalogue_variants.source_reference is
  'Dataset identifier or public source reference used for provenance.';

create table public.vehicle_catalogue_years (
  variant_id uuid not null references public.vehicle_catalogue_variants(id) on delete cascade,
  year_first_used smallint not null check (year_first_used between 1900 and 2100),
  source_reference text not null,
  primary key (variant_id, year_first_used)
);

create table public.vehicle_catalogue_engines (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.vehicle_catalogue_variants(id) on delete cascade,
  fuel_type text not null,
  engine_size_simple integer,
  engine_size_desc text,
  source_reference text not null,
  unique nulls not distinct (variant_id, fuel_type, engine_size_simple, engine_size_desc)
);

comment on table public.vehicle_catalogue_engines is
  'Possible fuel and engine-size combinations reported by the source for a detailed vehicle model. They are not claimed to be exact year-to-engine mappings.';

create table public.vehicle_catalogue_imports (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  dataset text not null,
  source_url text not null,
  source_published_at date,
  imported_at timestamptz not null default now(),
  imported_rows integer,
  notes text,
  unique (provider, dataset, source_published_at)
);

create index vehicle_catalogue_make_model_idx
  on public.vehicle_catalogue_variants(make, model_family, variant);
create index vehicle_catalogue_provider_idx
  on public.vehicle_catalogue_variants(provider, make);
create index vehicle_catalogue_year_idx
  on public.vehicle_catalogue_years(year_first_used, variant_id);
create index vehicle_catalogue_engine_idx
  on public.vehicle_catalogue_engines(variant_id, fuel_type, engine_size_simple);

alter table public.vehicle_catalogue_variants enable row level security;
alter table public.vehicle_catalogue_years enable row level security;
alter table public.vehicle_catalogue_engines enable row level security;
alter table public.vehicle_catalogue_imports enable row level security;

create policy "vehicle catalogue variants public read"
  on public.vehicle_catalogue_variants for select
  to anon, authenticated using (true);
create policy "vehicle catalogue years public read"
  on public.vehicle_catalogue_years for select
  to anon, authenticated using (true);
create policy "vehicle catalogue engines public read"
  on public.vehicle_catalogue_engines for select
  to anon, authenticated using (true);

create policy "vehicle catalogue variants admin insert"
  on public.vehicle_catalogue_variants for insert
  to authenticated with check (private.is_admin());
create policy "vehicle catalogue variants admin update"
  on public.vehicle_catalogue_variants for update
  to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "vehicle catalogue variants admin delete"
  on public.vehicle_catalogue_variants for delete
  to authenticated using (private.is_admin());

create policy "vehicle catalogue years admin insert"
  on public.vehicle_catalogue_years for insert
  to authenticated with check (private.is_admin());
create policy "vehicle catalogue years admin update"
  on public.vehicle_catalogue_years for update
  to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "vehicle catalogue years admin delete"
  on public.vehicle_catalogue_years for delete
  to authenticated using (private.is_admin());

create policy "vehicle catalogue engines admin insert"
  on public.vehicle_catalogue_engines for insert
  to authenticated with check (private.is_admin());
create policy "vehicle catalogue engines admin update"
  on public.vehicle_catalogue_engines for update
  to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "vehicle catalogue engines admin delete"
  on public.vehicle_catalogue_engines for delete
  to authenticated using (private.is_admin());

create policy "vehicle catalogue imports admin read"
  on public.vehicle_catalogue_imports for select
  to authenticated using (private.is_admin());
create policy "vehicle catalogue imports admin insert"
  on public.vehicle_catalogue_imports for insert
  to authenticated with check (private.is_admin());
create policy "vehicle catalogue imports admin update"
  on public.vehicle_catalogue_imports for update
  to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "vehicle catalogue imports admin delete"
  on public.vehicle_catalogue_imports for delete
  to authenticated using (private.is_admin());

revoke all on table public.vehicle_catalogue_variants from anon, authenticated;
revoke all on table public.vehicle_catalogue_years from anon, authenticated;
revoke all on table public.vehicle_catalogue_engines from anon, authenticated;
revoke all on table public.vehicle_catalogue_imports from anon, authenticated;

grant select on table public.vehicle_catalogue_variants to anon, authenticated;
grant select on table public.vehicle_catalogue_years to anon, authenticated;
grant select on table public.vehicle_catalogue_engines to anon, authenticated;
grant select, insert, update, delete on table public.vehicle_catalogue_variants to authenticated;
grant select, insert, update, delete on table public.vehicle_catalogue_years to authenticated;
grant select, insert, update, delete on table public.vehicle_catalogue_engines to authenticated;
grant select, insert, update, delete on table public.vehicle_catalogue_imports to authenticated;
