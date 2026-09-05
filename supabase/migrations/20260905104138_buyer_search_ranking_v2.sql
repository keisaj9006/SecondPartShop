create or replace function public.marketplace_search_part_ids(p_query text)
returns table(part_id uuid)
language sql
stable
set search_path=''
as $$
 with recursive category_ancestors as (
  select c.id category_id,c.parent_id,pg_catalog.concat_ws(' ',c.name,c.slug,pg_catalog.array_to_string(c.search_terms,' ')) searchable
  from public.categories c
  union all
  select child.category_id,parent.parent_id,pg_catalog.concat_ws(' ',child.searchable,parent.name,parent.slug,pg_catalog.array_to_string(parent.search_terms,' '))
  from category_ancestors child
  join public.categories parent on parent.id=child.parent_id
 ),
 category_search as (
  select category_id,pg_catalog.string_agg(searchable,' ') searchable
  from category_ancestors
  group by category_id
 ),
 prepared_query as (
  select pg_catalog.btrim(p_query) raw_query,
         pg_catalog.lower(pg_catalog.btrim(p_query)) lower_query,
         pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(p_query)),'[^a-z0-9]','','g') compact_query,
         pg_catalog.websearch_to_tsquery('english',p_query) ts_query
 ),
 documents as (
  select p.id,p.created_at,p.title,p.description,p.manufacturer,p.part_number,p.oem_number,
         p.gearbox_family,p.gearbox_code,leaf.name category_name,
         pg_catalog.lower(c.searchable) category_text,
         pg_catalog.lower(pg_catalog.concat_ws(' ',p.title,p.description,p.manufacturer,p.part_number,p.oem_number,p.gearbox_family,p.gearbox_code)) search_text,
         pg_catalog.to_tsvector('english',pg_catalog.concat_ws(' ',p.title,p.description,p.manufacturer,p.oem_number,p.part_number,p.gearbox_code,p.gearbox_family)) search_vector
  from public.parts p
  join public.categories leaf on leaf.id=p.category_id
  join category_search c on c.category_id=p.category_id
  where p.status='active'::public.listing_status
 ),
 ranked as (
  select d.id part_id,d.created_at,greatest(
   case when q.compact_query<>'' and pg_catalog.regexp_replace(pg_catalog.lower(coalesce(d.oem_number,'')),'[^a-z0-9]','','g')=q.compact_query then 140 else 0 end,
   case when q.compact_query<>'' and pg_catalog.regexp_replace(pg_catalog.lower(coalesce(d.part_number,'')),'[^a-z0-9]','','g')=q.compact_query then 135 else 0 end,
   case when pg_catalog.lower(d.title)=q.lower_query then 130 else 0 end,
   case when pg_catalog.lower(d.title) like q.lower_query||'%' then 120 else 0 end,
   case when pg_catalog.lower(d.category_name)=q.lower_query then 110 else 0 end,
   case when pg_catalog.lower(coalesce(d.manufacturer,''))=q.lower_query then 105 else 0 end,
   case when q.compact_query<>'' and pg_catalog.strpos(pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.concat_ws(' ',d.oem_number,d.part_number)),'[^a-z0-9]','','g'),q.compact_query)>0 then 95 else 0 end,
   case when pg_catalog.lower(d.title) like '%'||q.lower_query||'%' then 90 else 0 end,
   case when d.category_text like '%'||q.lower_query||'%' then 80 else 0 end,
   case when pg_catalog.lower(coalesce(d.manufacturer,'')) like '%'||q.lower_query||'%' then 75 else 0 end,
   case when d.search_text like '%'||q.lower_query||'%' then 65 else 0 end,
   case when d.search_vector@@q.ts_query then 50+pg_catalog.floor(pg_catalog.ts_rank(d.search_vector,q.ts_query)*20)::integer else 0 end
  ) search_rank
  from documents d
  cross join prepared_query q
  where q.raw_query<>''
    and (
      d.search_vector@@q.ts_query
      or d.search_text like '%'||q.lower_query||'%'
      or d.category_text like '%'||q.lower_query||'%'
      or (q.compact_query<>'' and pg_catalog.strpos(pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.concat_ws(' ',d.oem_number,d.part_number,d.gearbox_code)),'[^a-z0-9]','','g'),q.compact_query)>0)
    )
 )
 select ranked.part_id
 from ranked
 order by ranked.search_rank desc,ranked.created_at desc,ranked.part_id
 limit 500;
$$;

revoke all on function public.marketplace_search_part_ids(text) from public;
grant execute on function public.marketplace_search_part_ids(text) to anon,authenticated;
