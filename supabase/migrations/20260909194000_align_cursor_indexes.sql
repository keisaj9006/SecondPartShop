-- Align keyset pagination indexes exactly with cursor ORDER BY clauses.
-- The final UUID tie-breaker must use the same DESC direction as the cursor.

drop index if exists public.parts_active_created_idx;
create index parts_active_created_idx
  on public.parts(created_at desc,id desc)
  where status='active'::public.listing_status;

drop index if exists public.parts_active_category_created_idx;
create index parts_active_category_created_idx
  on public.parts(category_id,created_at desc,id desc)
  where status='active'::public.listing_status;

drop index if exists public.parts_seller_updated_idx;
create index parts_seller_updated_idx
  on public.parts(seller_id,updated_at desc,id desc);
