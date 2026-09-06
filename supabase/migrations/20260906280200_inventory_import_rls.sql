drop policy if exists "seller import owner insert" on public.seller_inventory_imports;
create policy "seller import owner insert"
  on public.seller_inventory_imports for insert
  to authenticated
  with check (
    exists(
      select 1 from public.sellers s
      where s.id=seller_id and s.owner_id=(select auth.uid())
    )
  );

drop policy if exists "seller import owner update" on public.seller_inventory_imports;
create policy "seller import owner update"
  on public.seller_inventory_imports for update
  to authenticated
  using (
    exists(
      select 1 from public.sellers s
      where s.id=seller_id and s.owner_id=(select auth.uid())
    )
  )
  with check (
    exists(
      select 1 from public.sellers s
      where s.id=seller_id and s.owner_id=(select auth.uid())
    )
  );

grant update on public.seller_inventory_imports to authenticated;
