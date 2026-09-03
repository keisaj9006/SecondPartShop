create index if not exists categories_parent_idx on public.categories(parent_id);
create index if not exists order_items_part_idx on public.order_items(part_id);
create index if not exists order_items_seller_idx on public.order_items(seller_id);
create index if not exists parts_category_idx on public.parts(category_id);
create index if not exists saved_parts_part_idx on public.saved_parts(part_id);

drop policy if exists "categories admin write" on public.categories;
create policy "categories admin insert" on public.categories for insert to authenticated with check(private.is_admin());
create policy "categories admin update" on public.categories for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy "categories admin delete" on public.categories for delete to authenticated using(private.is_admin());

drop policy if exists "vehicles admin write" on public.vehicles;
create policy "vehicles admin insert" on public.vehicles for insert to authenticated with check(private.is_admin());
create policy "vehicles admin update" on public.vehicles for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy "vehicles admin delete" on public.vehicles for delete to authenticated using(private.is_admin());

drop policy if exists "parts public read active" on public.parts;
drop policy if exists "parts owner read" on public.parts;
create policy "parts anon read active" on public.parts for select to anon using(status='active');
create policy "parts authenticated read" on public.parts for select to authenticated using(status='active' or private.owns_seller(seller_id) or private.is_admin());

drop policy if exists "images public read active" on public.part_images;
drop policy if exists "images owner read" on public.part_images;
create policy "images anon read active" on public.part_images for select to anon using(exists(select 1 from public.parts p where p.id=part_images.part_id and p.status='active'));
create policy "images authenticated read" on public.part_images for select to authenticated using(private.owns_part(part_id) or private.is_admin() or exists(select 1 from public.parts p where p.id=part_images.part_id and p.status='active'));

drop policy if exists "fitments public read active" on public.part_fitments;
drop policy if exists "fitments owner read" on public.part_fitments;
create policy "fitments anon read active" on public.part_fitments for select to anon using(exists(select 1 from public.parts p where p.id=part_fitments.part_id and p.status='active'));
create policy "fitments authenticated read" on public.part_fitments for select to authenticated using(private.owns_part(part_id) or private.is_admin() or exists(select 1 from public.parts p where p.id=part_fitments.part_id and p.status='active'));
