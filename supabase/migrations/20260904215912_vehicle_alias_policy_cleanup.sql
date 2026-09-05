-- Keep vehicle catalogue make-alias writes admin-only while allowing public reads.
alter table public.vehicle_catalogue_make_aliases enable row level security;

drop policy if exists "vehicle catalogue make aliases admin write" on public.vehicle_catalogue_make_aliases;
drop policy if exists "vehicle catalogue make aliases public read" on public.vehicle_catalogue_make_aliases;
drop policy if exists "vehicle catalogue make aliases admin insert" on public.vehicle_catalogue_make_aliases;
drop policy if exists "vehicle catalogue make aliases admin update" on public.vehicle_catalogue_make_aliases;
drop policy if exists "vehicle catalogue make aliases admin delete" on public.vehicle_catalogue_make_aliases;

create policy "vehicle catalogue make aliases public read"
  on public.vehicle_catalogue_make_aliases for select
  to anon,authenticated using(true);

create policy "vehicle catalogue make aliases admin insert"
  on public.vehicle_catalogue_make_aliases for insert
  to authenticated with check(private.is_admin());

create policy "vehicle catalogue make aliases admin update"
  on public.vehicle_catalogue_make_aliases for update
  to authenticated using(private.is_admin()) with check(private.is_admin());

create policy "vehicle catalogue make aliases admin delete"
  on public.vehicle_catalogue_make_aliases for delete
  to authenticated using(private.is_admin());
