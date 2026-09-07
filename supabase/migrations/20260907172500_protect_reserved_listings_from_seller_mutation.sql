drop policy if exists "parts owner create" on public.parts;
create policy "parts owner create" on public.parts
for insert to authenticated
with check (
  (private.owns_seller(seller_id) and status<>'reserved'::public.listing_status)
  or private.is_admin()
);

drop policy if exists "parts owner update" on public.parts;
create policy "parts owner update" on public.parts
for update to authenticated
using (
  (private.owns_seller(seller_id) and status<>'reserved'::public.listing_status)
  or private.is_admin()
)
with check (
  (private.owns_seller(seller_id) and status<>'reserved'::public.listing_status)
  or private.is_admin()
);

drop policy if exists "parts owner delete" on public.parts;
create policy "parts owner delete" on public.parts
for delete to authenticated
using (
  (private.owns_seller(seller_id) and status<>'reserved'::public.listing_status)
  or private.is_admin()
);
