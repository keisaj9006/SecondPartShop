drop index if exists public.parts_seller_source_external_unique;

create unique index if not exists parts_seller_source_external_unique
  on public.parts(seller_id,source_channel,lower(source_external_id))
  where source_external_id is not null;
