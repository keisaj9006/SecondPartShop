create table if not exists public.garage_vehicles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  catalogue_variant_id uuid not null references public.vehicle_catalogue_variants(id) on delete restrict,
  registration text,
  year smallint not null check (year between 1900 and 2100),
  fuel_type text,
  engine_size_simple integer check (engine_size_simple is null or engine_size_simple between 100 and 10000),
  nickname text check (nickname is null or char_length(nickname) <= 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration is null or registration ~ '^[A-Z0-9]{2,8}$')
);

create unique index if not exists garage_vehicles_identity_idx
  on public.garage_vehicles (
    profile_id,
    catalogue_variant_id,
    year,
    coalesce(fuel_type,''),
    coalesce(engine_size_simple,-1),
    coalesce(registration,'')
  );

create index if not exists garage_vehicles_profile_idx
  on public.garage_vehicles(profile_id, created_at desc);

alter table public.garage_vehicles enable row level security;

drop policy if exists "garage vehicles own read" on public.garage_vehicles;
create policy "garage vehicles own read"
  on public.garage_vehicles for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "garage vehicles own insert" on public.garage_vehicles;
create policy "garage vehicles own insert"
  on public.garage_vehicles for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "garage vehicles own update" on public.garage_vehicles;
create policy "garage vehicles own update"
  on public.garage_vehicles for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "garage vehicles own delete" on public.garage_vehicles;
create policy "garage vehicles own delete"
  on public.garage_vehicles for delete
  to authenticated
  using (auth.uid() = profile_id);

grant select,insert,update,delete on public.garage_vehicles to authenticated;
