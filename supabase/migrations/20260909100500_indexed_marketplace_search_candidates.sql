-- Scale marketplace search by building a bounded candidate set from indexed predicates
-- before applying the existing relevance weights.

create index if not exists parts_active_oem_compact_trgm_idx
  on public.parts using gin (
    (regexp_replace(lower(coalesce(oem_number,'')),'[^a-z0-9]','','g')) extensions.gin_trgm_ops
  )
  where status='active'::public.listing_status and oem_number is not null;

create index if not exists parts_active_part_number_compact_trgm_idx
  on public.parts using gin (
    (regexp_replace(lower(coalesce(part_number,'')),'[^a-z0-9]','','g')) extensions.gin_trgm_ops
  )
  where status='active'::public.listing_status and part_number is not null;

create or replace function public.marketplace_search_part_ids_limited(
  p_query text,
  p_limit integer default 20
)
returns table(part_id uuid)
language sql
stable
set search_path=''
as $$
 with recursive category_ancestors as (
  select
   c.id category_id,
   c.parent_id,
   pg_catalog.concat_ws(
    ' ',
    c.name,
    c.slug,
    pg_catalog.array_to_string(c.search_terms,' ')
   ) searchable
  from public.categories c

  union all

  select
   child.category_id,
   parent.parent_id,
   pg_catalog.concat_ws(
    ' ',
    child.searchable,
    parent.name,
    parent.slug
   )
  from category_ancestors child
  join public.categories parent on parent.id=child.parent_id
 ),
 category_search as (
  select category_id,pg_catalog.string_agg(searchable,' ') searchable
  from category_ancestors
  group by category_id
 ),
 prepared_query as (
  select
   pg_catalog.btrim(p_query) raw_query,
   pg_catalog.lower(pg_catalog.btrim(p_query)) lower_query,
   pg_catalog.regexp_replace(
    pg_catalog.lower(pg_catalog.btrim(p_query)),
    '[^a-z0-9]',
    '',
    'g'
   ) compact_query,
   pg_catalog.websearch_to_tsquery('english',p_query) ts_query,
   greatest(
    100,
    least(coalesce(p_limit,20)*6,1500)
   ) candidate_limit
 ),
 category_matches as (
  select c.category_id
  from category_search c
  cross join prepared_query q
  where pg_catalog.lower(c.searchable) like '%'||q.lower_query||'%'
 ),
 candidate_rows as (
  select id from (
   select p.id
   from public.parts p
   cross join prepared_query q
   where p.status='active'::public.listing_status
    and q.raw_query<>''
    and p.search_document@@q.ts_query
   order by pg_catalog.ts_rank(p.search_document,q.ts_query) desc,p.created_at desc,p.id
   limit (select candidate_limit from prepared_query)
  ) fts

  union all

  select id from (
   select p.id
   from public.parts p
   cross join prepared_query q
   where p.status='active'::public.listing_status
    and q.raw_query<>''
    and pg_catalog.lower(p.title) like '%'||q.lower_query||'%'
   order by
    (pg_catalog.lower(p.title)=q.lower_query) desc,
    (pg_catalog.lower(p.title) like q.lower_query||'%') desc,
    p.created_at desc,
    p.id
   limit (select candidate_limit from prepared_query)
  ) title_match

  union all

  select id from (
   select p.id
   from public.parts p
   cross join prepared_query q
   where p.status='active'::public.listing_status
    and q.raw_query<>''
    and pg_catalog.lower(coalesce(p.manufacturer,'')) like '%'||q.lower_query||'%'
   order by
    (pg_catalog.lower(coalesce(p.manufacturer,''))=q.lower_query) desc,
    p.created_at desc,
    p.id
   limit (select candidate_limit from prepared_query)
  ) manufacturer_match

  union all

  select id from (
   select p.id
   from public.parts p
   cross join prepared_query q
   where p.status='active'::public.listing_status
    and q.compact_query<>''
    and pg_catalog.regexp_replace(
     pg_catalog.lower(coalesce(p.oem_number,'')),
     '[^a-z0-9]',
     '',
     'g'
    ) like '%'||q.compact_query||'%'
   order by
    (pg_catalog.regexp_replace(
      pg_catalog.lower(coalesce(p.oem_number,'')),
      '[^a-z0-9]',
      '',
      'g'
     )=q.compact_query) desc,
    p.created_at desc,
    p.id
   limit (select candidate_limit from prepared_query)
  ) oem_match

  union all

  select id from (
   select p.id
   from public.parts p
   cross join prepared_query q
   where p.status='active'::public.listing_status
    and q.compact_query<>''
    and pg_catalog.regexp_replace(
     pg_catalog.lower(coalesce(p.part_number,'')),
     '[^a-z0-9]',
     '',
     'g'
    ) like '%'||q.compact_query||'%'
   order by
    (pg_catalog.regexp_replace(
      pg_catalog.lower(coalesce(p.part_number,'')),
      '[^a-z0-9]',
      '',
      'g'
     )=q.compact_query) desc,
    p.created_at desc,
    p.id
   limit (select candidate_limit from prepared_query)
  ) part_number_match

  union all

  select id from (
   select p.id
   from public.parts p
   cross join prepared_query q
   where p.status='active'::public.listing_status
    and q.raw_query<>''
    and pg_catalog.lower(coalesce(p.gearbox_code,'')) like '%'||q.lower_query||'%'
   order by p.created_at desc,p.id
   limit (select candidate_limit from prepared_query)
  ) gearbox_code_match

  union all

  select id from (
   select p.id
   from public.parts p
   cross join prepared_query q
   where p.status='active'::public.listing_status
    and q.raw_query<>''
    and pg_catalog.lower(coalesce(p.gearbox_family,'')) like '%'||q.lower_query||'%'
   order by p.created_at desc,p.id
   limit (select candidate_limit from prepared_query)
  ) gearbox_family_match

  union all

  select id from (
   select p.id
   from public.parts p
   where p.status='active'::public.listing_status
    and p.category_id in (select category_id from category_matches)
   order by p.created_at desc,p.id
   limit (select candidate_limit from prepared_query)
  ) category_match
 ),
 candidate_ids as (
  select distinct id
  from candidate_rows
 ),
 documents as (
  select
   p.id,
   p.created_at,
   p.title,
   p.description,
   p.manufacturer,
   p.part_number,
   p.oem_number,
   p.gearbox_family,
   p.gearbox_code,
   leaf.name category_name,
   pg_catalog.lower(c.searchable) category_text,
   pg_catalog.lower(
    pg_catalog.concat_ws(
     ' ',
     p.title,
     p.description,
     p.manufacturer,
     p.part_number,
     p.oem_number,
     p.gearbox_family,
     p.gearbox_code
    )
   ) search_text,
   p.search_document search_vector
  from candidate_ids candidate
  join public.parts p on p.id=candidate.id
  join public.categories leaf on leaf.id=p.category_id
  join category_search c on c.category_id=p.category_id
 ),
 ranked as (
  select
   d.id part_id,
   d.created_at,
   greatest(
    case
     when q.compact_query<>''
      and pg_catalog.regexp_replace(
       pg_catalog.lower(coalesce(d.oem_number,'')),
       '[^a-z0-9]',
       '',
       'g'
      )=q.compact_query
     then 140 else 0
    end,
    case
     when q.compact_query<>''
      and pg_catalog.regexp_replace(
       pg_catalog.lower(coalesce(d.part_number,'')),
       '[^a-z0-9]',
       '',
       'g'
      )=q.compact_query
     then 135 else 0
    end,
    case when pg_catalog.lower(d.title)=q.lower_query then 130 else 0 end,
    case when pg_catalog.lower(d.title) like q.lower_query||'%' then 120 else 0 end,
    case when pg_catalog.lower(d.category_name)=q.lower_query then 110 else 0 end,
    case when pg_catalog.lower(coalesce(d.manufacturer,''))=q.lower_query then 105 else 0 end,
    case
     when q.compact_query<>''
      and pg_catalog.strpos(
       pg_catalog.regexp_replace(
        pg_catalog.lower(pg_catalog.concat_ws(' ',d.oem_number,d.part_number)),
        '[^a-z0-9]',
        '',
        'g'
       ),
       q.compact_query
      )>0
     then 95 else 0
    end,
    case when pg_catalog.lower(d.title) like '%'||q.lower_query||'%' then 90 else 0 end,
    case when d.category_text like '%'||q.lower_query||'%' then 80 else 0 end,
    case when pg_catalog.lower(coalesce(d.manufacturer,'')) like '%'||q.lower_query||'%' then 75 else 0 end,
    case when d.search_text like '%'||q.lower_query||'%' then 65 else 0 end,
    case
     when d.search_vector@@q.ts_query
     then 50+pg_catalog.floor(pg_catalog.ts_rank(d.search_vector,q.ts_query)*20)::integer
     else 0
    end
   ) search_rank
  from documents d
  cross join prepared_query q
  where q.raw_query<>''
 )
 select ranked.part_id
 from ranked
 order by ranked.search_rank desc,ranked.created_at desc,ranked.part_id
 limit greatest(1,least(coalesce(p_limit,20),500));
$$;

revoke all on function public.marketplace_search_part_ids_limited(text,integer) from public;
grant execute on function public.marketplace_search_part_ids_limited(text,integer) to anon,authenticated;
