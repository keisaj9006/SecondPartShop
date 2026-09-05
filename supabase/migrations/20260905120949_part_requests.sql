create table if not exists public.part_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  catalogue_variant_id uuid references public.vehicle_catalogue_variants(id) on delete set null,
  registration text,
  year smallint check (year is null or year between 1900 and 2100),
  fuel_type text,
  engine_size_simple integer check (engine_size_simple is null or engine_size_simple between 100 and 10000),
  query_text text not null check (char_length(query_text) between 3 and 160),
  oem_number text check (oem_number is null or char_length(oem_number) <= 80),
  notes text check (notes is null or char_length(notes) <= 1000),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration is null or registration ~ '^[A-Z0-9]{2,8}$')
);

create index if not exists part_requests_profile_idx
  on public.part_requests(profile_id, created_at desc);

create index if not exists part_requests_open_idx
  on public.part_requests(status, created_at desc);

alter table public.part_requests enable row level security;

drop policy if exists "part requests own read" on public.part_requests;
create policy "part requests own read"
  on public.part_requests for select
  to authenticated
  using (auth.uid()=profile_id);

drop policy if exists "part requests own insert" on public.part_requests;
create policy "part requests own insert"
  on public.part_requests for insert
  to authenticated
  with check (auth.uid()=profile_id);

drop policy if exists "part requests own update" on public.part_requests;
create policy "part requests own update"
  on public.part_requests for update
  to authenticated
  using (auth.uid()=profile_id)
  with check (auth.uid()=profile_id);

drop policy if exists "part requests own delete" on public.part_requests;
create policy "part requests own delete"
  on public.part_requests for delete
  to authenticated
  using (auth.uid()=profile_id);

grant select,insert,update,delete on public.part_requests to authenticated;
