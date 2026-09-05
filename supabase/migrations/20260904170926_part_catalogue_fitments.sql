create table public.part_catalogue_fitments (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  variant_id uuid not null references public.vehicle_catalogue_variants(id) on delete cascade,
  year_from smallint check (year_from is null or year_from between 1900 and 2100),
  year_to smallint check (year_to is null or year_to between 1900 and 2100),
  fuel_type text,
  engine_size_simple integer check (engine_size_simple is null or engine_size_simple > 0),
  notes text,
  created_at timestamptz not null default now(),
  constraint part_catalogue_fitments_year_range_check
    check (year_from is null or year_to is null or year_to >= year_from),
  unique nulls not distinct (
    part_id, variant_id, year_from, year_to, fuel_type, engine_size_simple
  )
);

comment on table public.part_catalogue_fitments is
  'Seller-declared compatibility against the provider-neutral vehicle catalogue. Null year/fuel/engine fields mean the fitment applies broadly to that catalogue variant.';

create index part_catalogue_fitments_variant_idx
  on public.part_catalogue_fitments(variant_id);
create index part_catalogue_fitments_part_idx
  on public.part_catalogue_fitments(part_id);

alter table public.part_catalogue_fitments enable row level security;

create policy "catalogue fitments anon read active"
  on public.part_catalogue_fitments for select
  to anon
  using (
    exists (
      select 1 from public.parts p
      where p.id = part_catalogue_fitments.part_id
        and p.status = 'active'::public.listing_status
    )
  );

create policy "catalogue fitments authenticated read"
  on public.part_catalogue_fitments for select
  to authenticated
  using (
    private.owns_part(part_id)
    or private.is_admin()
    or exists (
      select 1 from public.parts p
      where p.id = part_catalogue_fitments.part_id
        and p.status = 'active'::public.listing_status
    )
  );

create policy "catalogue fitments owner create"
  on public.part_catalogue_fitments for insert
  to authenticated
  with check (private.owns_part(part_id) or private.is_admin());

create policy "catalogue fitments owner update"
  on public.part_catalogue_fitments for update
  to authenticated
  using (private.owns_part(part_id) or private.is_admin())
  with check (private.owns_part(part_id) or private.is_admin());

create policy "catalogue fitments owner delete"
  on public.part_catalogue_fitments for delete
  to authenticated
  using (private.owns_part(part_id) or private.is_admin());

revoke all on table public.part_catalogue_fitments from anon, authenticated;
grant select on table public.part_catalogue_fitments to anon, authenticated;
grant select, insert, update, delete on table public.part_catalogue_fitments to authenticated;
