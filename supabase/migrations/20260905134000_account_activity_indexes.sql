create index if not exists recently_viewed_parts_part_idx on public.recently_viewed_parts(part_id);
create index if not exists seller_part_request_leads_category_idx on public.seller_part_request_leads(category_id);
create index if not exists seller_part_request_leads_variant_idx on public.seller_part_request_leads(catalogue_variant_id);
alter table public.saved_searches drop constraint if exists saved_searches_search_params_object_check;
alter table public.saved_searches add constraint saved_searches_search_params_object_check check (jsonb_typeof(search_params)='object');
