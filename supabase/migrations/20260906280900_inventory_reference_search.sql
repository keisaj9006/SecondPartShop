create index if not exists parts_source_external_id_trgm_idx
  on public.parts using gin (lower(coalesce(source_external_id,'')) extensions.gin_trgm_ops)
  where source_external_id is not null;
