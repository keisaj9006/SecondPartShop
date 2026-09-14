-- Reduce repeated work in marketplace_search_page_v1 candidate discovery without
-- reintroducing the historical bounded-candidate correctness bug.
--
-- The complete eligible set remains authoritative and global ranking/sorting is
-- unchanged. Only the eight UNION scans of the same eligible relation are
-- replaced by one scan with the identical OR predicate set.
--
-- Patch the exact known definition and fail closed if it has drifted.
do $$
declare
  target oid;
  original text;
  optimized text;
  verified text;
  occurrences integer;
  needle text := $needle$ candidate_ids as (
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and p.search_document@@q.ts_query
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and lower(p.title) like '%'||q.lower_query||'%'
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and lower(coalesce(p.manufacturer,'')) like '%'||q.lower_query||'%'
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and p.oem_number is not null and q.compact_query<>'' and regexp_replace(lower(coalesce(p.oem_number,'')),'[^a-z0-9]','','g') like '%'||q.compact_query||'%'
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and p.part_number is not null and q.compact_query<>'' and regexp_replace(lower(coalesce(p.part_number,'')),'[^a-z0-9]','','g') like '%'||q.compact_query||'%'
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and p.gearbox_code is not null and lower(coalesce(p.gearbox_code,'')) like '%'||q.lower_query||'%'
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and p.gearbox_family is not null and lower(coalesce(p.gearbox_family,'')) like '%'||q.lower_query||'%'
 union
 select p.id from eligible p cross join prepared_query q where q.raw_query<>'' and p.category_id in (select category_id from category_search where lower(searchable) like '%'||q.lower_query||'%')
 ),$needle$;
  replacement text := $patch$ candidate_ids as (
 select p.id
 from eligible p
 cross join prepared_query q
 where q.raw_query<>''
   and (
    p.search_document@@q.ts_query
    or lower(p.title) like '%'||q.lower_query||'%'
    or lower(coalesce(p.manufacturer,'')) like '%'||q.lower_query||'%'
    or (p.oem_number is not null and q.compact_query<>'' and regexp_replace(lower(coalesce(p.oem_number,'')),'[^a-z0-9]','','g') like '%'||q.compact_query||'%')
    or (p.part_number is not null and q.compact_query<>'' and regexp_replace(lower(coalesce(p.part_number,'')),'[^a-z0-9]','','g') like '%'||q.compact_query||'%')
    or (p.gearbox_code is not null and lower(coalesce(p.gearbox_code,'')) like '%'||q.lower_query||'%')
    or (p.gearbox_family is not null and lower(coalesce(p.gearbox_family,'')) like '%'||q.lower_query||'%')
    or p.category_id in (select category_id from category_search where lower(searchable) like '%'||q.lower_query||'%')
   )
 ),$patch$;
begin
  target:=to_regprocedure('public.marketplace_search_page_v1(text,text,uuid[],text,integer,integer,boolean,uuid,smallint,text,integer,uuid,boolean,double precision,double precision,uuid[],integer,integer)');
  if target is null then
    raise exception 'Expected marketplace_search_page_v1 RPC is missing';
  end if;

  select pg_get_functiondef(target) into original;
  occurrences:=(length(original)-length(replace(original,needle,'')))/greatest(length(needle),1);
  if occurrences<>1 then
    raise exception 'marketplace_search_page_v1 definition drift: expected one candidate patch point but found %',occurrences;
  end if;

  optimized:=replace(original,needle,replacement);
  if optimized is not distinct from original then
    raise exception 'marketplace_search_page_v1 single-scan optimization made no change';
  end if;

  execute optimized;

  select pg_get_functiondef(target) into verified;
  if position(needle in verified)<>0 or position(replacement in verified)=0 then
    raise exception 'marketplace_search_page_v1 single-scan optimization failed postcondition';
  end if;
end;
$$;

-- Preserve the existing public read-only RPC execution contract and hardened
-- SECURITY DEFINER posture.
alter function public.marketplace_search_page_v1(text,text,uuid[],text,integer,integer,boolean,uuid,smallint,text,integer,uuid,boolean,double precision,double precision,uuid[],integer,integer) security definer;
alter function public.marketplace_search_page_v1(text,text,uuid[],text,integer,integer,boolean,uuid,smallint,text,integer,uuid,boolean,double precision,double precision,uuid[],integer,integer) set search_path = '';
revoke all on function public.marketplace_search_page_v1(text,text,uuid[],text,integer,integer,boolean,uuid,smallint,text,integer,uuid,boolean,double precision,double precision,uuid[],integer,integer) from public;
grant execute on function public.marketplace_search_page_v1(text,text,uuid[],text,integer,integer,boolean,uuid,smallint,text,integer,uuid,boolean,double precision,double precision,uuid[],integer,integer) to anon,authenticated;
grant execute on function public.marketplace_search_page_v1(text,text,uuid[],text,integer,integer,boolean,uuid,smallint,text,integer,uuid,boolean,double precision,double precision,uuid[],integer,integer) to service_role;
