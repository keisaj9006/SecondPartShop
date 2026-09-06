-- Marketplace scale indexes for paginated catalogue reads and exact part-number lookup.

create index if not exists parts_active_created_idx
  on public.parts(created_at desc,id)
  where status='active'::public.listing_status;

create index if not exists parts_active_category_created_idx
  on public.parts(category_id,created_at desc,id)
  where status='active'::public.listing_status;

create index if not exists parts_active_price_idx
  on public.parts(price_pence,created_at desc,id)
  where status='active'::public.listing_status;

create index if not exists parts_active_delivery_idx
  on public.parts(delivery_days_min,created_at desc,id)
  where status='active'::public.listing_status;

create index if not exists parts_active_warranty_idx
  on public.parts(warranty_days desc,created_at desc,id)
  where status='active'::public.listing_status;

create index if not exists parts_active_oem_compact_idx
  on public.parts (
    (regexp_replace(lower(coalesce(oem_number,'')),'[^a-z0-9]','','g'))
  )
  where status='active'::public.listing_status and oem_number is not null;

create index if not exists parts_active_part_number_compact_idx
  on public.parts (
    (regexp_replace(lower(coalesce(part_number,'')),'[^a-z0-9]','','g'))
  )
  where status='active'::public.listing_status and part_number is not null;
