create extension if not exists pg_trgm with schema extensions;

create index if not exists parts_title_trgm_idx
  on public.parts using gin (lower(title) extensions.gin_trgm_ops);

create index if not exists parts_oem_number_trgm_idx
  on public.parts using gin (lower(coalesce(oem_number,'')) extensions.gin_trgm_ops);

create index if not exists parts_part_number_trgm_idx
  on public.parts using gin (lower(coalesce(part_number,'')) extensions.gin_trgm_ops);

create index if not exists parts_manufacturer_trgm_idx
  on public.parts using gin (lower(coalesce(manufacturer,'')) extensions.gin_trgm_ops);
