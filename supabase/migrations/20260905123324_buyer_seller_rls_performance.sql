create index if not exists garage_vehicles_catalogue_variant_idx
  on public.garage_vehicles(catalogue_variant_id);

create index if not exists part_requests_category_idx
  on public.part_requests(category_id);

create index if not exists part_requests_catalogue_variant_idx
  on public.part_requests(catalogue_variant_id);

drop policy if exists "garage vehicles own read" on public.garage_vehicles;
create policy "garage vehicles own read"
  on public.garage_vehicles for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "garage vehicles own insert" on public.garage_vehicles;
create policy "garage vehicles own insert"
  on public.garage_vehicles for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

drop policy if exists "garage vehicles own update" on public.garage_vehicles;
create policy "garage vehicles own update"
  on public.garage_vehicles for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

drop policy if exists "garage vehicles own delete" on public.garage_vehicles;
create policy "garage vehicles own delete"
  on public.garage_vehicles for delete
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "part requests own read" on public.part_requests;
create policy "part requests own read"
  on public.part_requests for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "part requests own insert" on public.part_requests;
create policy "part requests own insert"
  on public.part_requests for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

drop policy if exists "part requests own update" on public.part_requests;
create policy "part requests own update"
  on public.part_requests for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

drop policy if exists "part requests own delete" on public.part_requests;
create policy "part requests own delete"
  on public.part_requests for delete
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "donor vehicles seller read" on public.donor_vehicles;
create policy "donor vehicles seller read"
  on public.donor_vehicles for select
  to authenticated
  using (
    exists (
      select 1 from public.sellers s
      where s.id=donor_vehicles.seller_id
        and (s.owner_id=(select auth.uid()) or private.is_admin())
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
        and (s.owner_id=(select auth.uid()) or private.is_admin())
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
        and (s.owner_id=(select auth.uid()) or private.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.sellers s
      where s.id=donor_vehicles.seller_id
        and (s.owner_id=(select auth.uid()) or private.is_admin())
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
        and (s.owner_id=(select auth.uid()) or private.is_admin())
    )
  );
