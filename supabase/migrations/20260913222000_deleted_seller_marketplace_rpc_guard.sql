-- Keep every public SECURITY DEFINER marketplace part-id RPC aligned with the
-- same deleted-seller visibility boundary as marketplace_search_page_v1.
--
-- These functions have accumulated over several pagination/search iterations.
-- Rewriting their bodies here would risk changing ranking, cursor, distance or
-- limit semantics. Instead, patch the exact known current definitions and fail
-- closed if any expected fragment has drifted.

do $$
declare
  patch record;
  target oid;
  original text;
  hardened text;
  occurrences integer;
begin
  for patch in
    select * from (values
      (
        'marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid)',
        E'  from combined\n  order by combined.part_id,combined.rank desc;',
        E'  from combined\n  join public.parts visible_part on visible_part.id=combined.part_id\n  join public.sellers visible_seller on visible_seller.id=visible_part.seller_id\n  where visible_part.status=''active''::public.listing_status\n    and visible_seller.account_deleted_at is null\n  order by combined.part_id,combined.rank desc;'
      ),
      (
        'marketplace_catalogue_cursor_page_v1(uuid,smallint,text,integer,uuid[],text,integer,integer,boolean,boolean,integer,timestamptz,uuid,integer)',
        E'    from public.parts p\n    left join compatibility c on c.part_id=p.id\n    where p.status=''active''::public.listing_status',
        E'    from public.parts p\n    join public.sellers visible_seller on visible_seller.id=p.seller_id\n    left join compatibility c on c.part_id=p.id\n    where p.status=''active''::public.listing_status\n      and visible_seller.account_deleted_at is null'
      ),
      (
        'marketplace_catalogue_distance_page(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer)',
        E'    from public.parts p\n    join public.sellers s on s.id=p.seller_id\n    left join compatibility c on c.part_id=p.id\n    where p.status=''active''::public.listing_status',
        E'    from public.parts p\n    join public.sellers s on s.id=p.seller_id\n    left join compatibility c on c.part_id=p.id\n    where p.status=''active''::public.listing_status\n      and s.account_deleted_at is null'
      ),
      (
        'marketplace_catalogue_distance_page_v2(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer)',
        E'    from public.sellers s\n  ),\n  filtered as (',
        E'    from public.sellers s\n    where s.account_deleted_at is null\n  ),\n  filtered as ('
      ),
      (
        'marketplace_catalogue_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer)',
        E'    from public.parts p\n    left join compatibility c on c.part_id=p.id\n    where p.status=''active''::public.listing_status',
        E'    from public.parts p\n    join public.sellers visible_seller on visible_seller.id=p.seller_id\n    left join compatibility c on c.part_id=p.id\n    where p.status=''active''::public.listing_status\n      and visible_seller.account_deleted_at is null'
      ),
      (
        'marketplace_catalogue_sorted_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,text,integer,integer)',
        E'    from public.parts p\n    left join compatibility c on c.part_id=p.id\n    where p.status=''active''::public.listing_status',
        E'    from public.parts p\n    join public.sellers visible_seller on visible_seller.id=p.seller_id\n    left join compatibility c on c.part_id=p.id\n    where p.status=''active''::public.listing_status\n      and visible_seller.account_deleted_at is null'
      ),
      (
        'marketplace_distance_page(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer)',
        E'    from public.parts p\n    join public.sellers s on s.id=p.seller_id\n    where p.status=''active''::public.listing_status',
        E'    from public.parts p\n    join public.sellers s on s.id=p.seller_id\n    where p.status=''active''::public.listing_status\n      and s.account_deleted_at is null'
      ),
      (
        'marketplace_distance_page_v2(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer)',
        E'    from public.sellers s\n  ),\n  filtered as (',
        E'    from public.sellers s\n    where s.account_deleted_at is null\n  ),\n  filtered as ('
      )
    ) as patches(signature,needle,replacement)
  loop
    target:=to_regprocedure('public.'||patch.signature);
    if target is null then
      raise exception 'Expected public marketplace RPC is missing: %',patch.signature;
    end if;

    select pg_get_functiondef(target) into original;
    occurrences:=(length(original)-length(replace(original,patch.needle,'')))/greatest(length(patch.needle),1);
    if occurrences<>1 then
      raise exception 'Marketplace RPC definition drift for %, expected one patch point but found %',patch.signature,occurrences;
    end if;

    hardened:=replace(original,patch.needle,patch.replacement);
    if hardened is not distinct from original then
      raise exception 'Marketplace RPC privacy hardening did not change %',patch.signature;
    end if;

    execute hardened;
  end loop;
end;
$$;

-- Reassert the public execution contract and immutable SECURITY DEFINER posture.
alter function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid) security definer;
alter function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid) set search_path = '';
revoke all on function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid) from public;
grant execute on function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid) to anon,authenticated;
grant execute on function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid) to service_role;

alter function public.marketplace_catalogue_cursor_page_v1(uuid,smallint,text,integer,uuid[],text,integer,integer,boolean,boolean,integer,timestamptz,uuid,integer) security definer;
alter function public.marketplace_catalogue_cursor_page_v1(uuid,smallint,text,integer,uuid[],text,integer,integer,boolean,boolean,integer,timestamptz,uuid,integer) set search_path = '';
revoke all on function public.marketplace_catalogue_cursor_page_v1(uuid,smallint,text,integer,uuid[],text,integer,integer,boolean,boolean,integer,timestamptz,uuid,integer) from public;
grant execute on function public.marketplace_catalogue_cursor_page_v1(uuid,smallint,text,integer,uuid[],text,integer,integer,boolean,boolean,integer,timestamptz,uuid,integer) to anon,authenticated;
grant execute on function public.marketplace_catalogue_cursor_page_v1(uuid,smallint,text,integer,uuid[],text,integer,integer,boolean,boolean,integer,timestamptz,uuid,integer) to service_role;

alter function public.marketplace_catalogue_distance_page(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) security definer;
alter function public.marketplace_catalogue_distance_page(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) set search_path = '';
revoke all on function public.marketplace_catalogue_distance_page(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) from public;
grant execute on function public.marketplace_catalogue_distance_page(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) to anon,authenticated;
grant execute on function public.marketplace_catalogue_distance_page(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) to service_role;

alter function public.marketplace_catalogue_distance_page_v2(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) security definer;
alter function public.marketplace_catalogue_distance_page_v2(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) set search_path = '';
revoke all on function public.marketplace_catalogue_distance_page_v2(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) from public;
grant execute on function public.marketplace_catalogue_distance_page_v2(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) to anon,authenticated;
grant execute on function public.marketplace_catalogue_distance_page_v2(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) to service_role;

alter function public.marketplace_catalogue_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) security definer;
alter function public.marketplace_catalogue_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) set search_path = '';
revoke all on function public.marketplace_catalogue_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) from public;
grant execute on function public.marketplace_catalogue_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) to anon,authenticated;
grant execute on function public.marketplace_catalogue_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer) to service_role;

alter function public.marketplace_catalogue_sorted_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,text,integer,integer) security definer;
alter function public.marketplace_catalogue_sorted_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,text,integer,integer) set search_path = '';
revoke all on function public.marketplace_catalogue_sorted_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,text,integer,integer) from public;
grant execute on function public.marketplace_catalogue_sorted_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,text,integer,integer) to anon,authenticated;
grant execute on function public.marketplace_catalogue_sorted_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,text,integer,integer) to service_role;

alter function public.marketplace_distance_page(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer) security definer;
alter function public.marketplace_distance_page(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer) set search_path = '';
revoke all on function public.marketplace_distance_page(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer) from public;
grant execute on function public.marketplace_distance_page(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer) to anon,authenticated;
grant execute on function public.marketplace_distance_page(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer) to service_role;

alter function public.marketplace_distance_page_v2(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer) security definer;
alter function public.marketplace_distance_page_v2(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer) set search_path = '';
revoke all on function public.marketplace_distance_page_v2(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer) from public;
grant execute on function public.marketplace_distance_page_v2(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer) to anon,authenticated;
grant execute on function public.marketplace_distance_page_v2(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer) to service_role;
