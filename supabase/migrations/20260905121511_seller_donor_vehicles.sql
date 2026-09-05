create table if not exists public.donor_vehicles (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  registration text,
  make text not null check (char_length(make) between 2 and 80),
  model text not null check (char_length(model) between 1 and 120),
  variant text,
  year smallint not null check (year between 1900 and 2100),
  fuel_type text,
  engine_size_simple integer check (engine_size_simple is null or engine_size_simple between 100 and 10000),
  colour text,
  notes text check (notes is null or char_length(notes)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration is null or registration ~ '^[A-Z0-9]{2,8}$')
);

create index if not exists donor_vehicles_seller_idx
  on public.donor_vehicles(seller_id,created_at desc);

alter table public.parts
  add column if not exists donor_vehicle_id uuid references public.donor_vehicles(id) on delete set null;

create index if not exists parts_donor_vehicle_idx
  on public.parts(donor_vehicle_id);

alter table public.donor_vehicles enable row level security;

drop policy if exists "donor vehicles seller read" on public.donor_vehicles;
create policy "donor vehicles seller read"
  on public.donor_vehicles for select
  to authenticated
  using (
    exists (
      select 1 from public.sellers s
      where s.id=donor_vehicles.seller_id
        and (s.owner_id=auth.uid() or private.is_admin())
    )
  );

drop policy if exists "donor vehicles seller insert" on public.donor_vehicles;
create policy "donor vehicles seller insert"
  on public.donor_vehicles for insert
  to authenticated
  with check (
    exists (
      select 1 from public.sellers s
      where s.id=donor_vehicles.seller_id
        and (s.owner_id=auth.uid() or private.is_admin())
    )
  );

drop policy if exists "donor vehicles seller update" on public.donor_vehicles;
create policy "donor vehicles seller update"
  on public.donor_vehicles for update
  to authenticated
  using (
    exists (
      select 1 from public.sellers s
      where s.id=donor_vehicles.seller_id
        and (s.owner_id=auth.uid() or private.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.sellers s
      where s.id=donor_vehicles.seller_id
        and (s.owner_id=auth.uid() or private.is_admin())
    )
  );

drop policy if exists "donor vehicles seller delete" on public.donor_vehicles;
create policy "donor vehicles seller delete"
  on public.donor_vehicles for delete
  to authenticated
  using (
    exists (
      select 1 from public.sellers s
      where s.id=donor_vehicles.seller_id
        and (s.owner_id=auth.uid() or private.is_admin())
    )
  );

grant select,insert,update,delete on public.donor_vehicles to authenticated;
