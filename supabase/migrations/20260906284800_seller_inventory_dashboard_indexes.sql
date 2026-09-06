create index if not exists parts_seller_updated_idx
  on public.parts(seller_id,updated_at desc,id);

create index if not exists parts_seller_status_updated_idx
  on public.parts(seller_id,status,updated_at desc,id);

create index if not exists parts_seller_source_updated_idx
  on public.parts(seller_id,source_channel,updated_at desc,id);

create index if not exists parts_seller_import_batch_updated_idx
  on public.parts(seller_id,import_batch_id,updated_at desc,id)
  where import_batch_id is not null;
