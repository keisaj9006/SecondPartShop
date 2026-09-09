-- Keyset pagination for the high-volume default marketplace browse path.
-- Cursor order matches parts_active_created_idx / parts_active_category_created_idx.

create or replace function public.marketplace_browse_cursor_page(
  p_category_ids uuid[] default null,
  p_condition text default null,
  p_min_price_pence integer default null,
  p_max_price_pence integer default null,
  p_collection_only boolean default false,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 24
)
returns table(part_id uuid,created_at timestamptz)
language sql
stable
set search_path=''
as $$
 select p.id,p.created_at
 from public.parts p
 where p.status='active'::public.listing_status
   and (p_category_ids is null or p.category_id=any(p_category_ids))
   and (p_condition is null or p.condition::text=p_condition)
   and (p_min_price_pence is null or p.price_pence>=p_min_price_pence)
   and (p_max_price_pence is null or p.price_pence<=p_max_price_pence)
   and (not coalesce(p_collection_only,false) or p.collection_available)
   and (
    p_after_created_at is null
    or p_after_id is null
    or (p.created_at,p.id)<(p_after_created_at,p_after_id)
   )
 order by p.created_at desc,p.id desc
 limit greatest(2,least(coalesce(p_limit,24),61));
$$;

revoke all on function public.marketplace_browse_cursor_page(uuid[],text,integer,integer,boolean,timestamptz,uuid,integer) from public;
grant execute on function public.marketplace_browse_cursor_page(uuid[],text,integer,integer,boolean,timestamptz,uuid,integer) to anon,authenticated;
