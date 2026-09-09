-- Keyset pagination for large seller inventories.
-- The order matches parts_seller_updated_idx (seller_id, updated_at desc, id).

create or replace function public.seller_inventory_cursor_page(
  p_seller_id uuid,
  p_after_updated_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table(part_id uuid,updated_at timestamptz)
language sql
stable
set search_path=''
as $$
 select p.id,p.updated_at
 from public.parts p
 where p.seller_id=p_seller_id
   and (
    p_after_updated_at is null
    or p_after_id is null
    or (p.updated_at,p.id)<(p_after_updated_at,p_after_id)
   )
 order by p.updated_at desc,p.id desc
 limit greatest(2,least(coalesce(p_limit,25),101));
$$;

revoke all on function public.seller_inventory_cursor_page(uuid,timestamptz,uuid,integer) from public;
grant execute on function public.seller_inventory_cursor_page(uuid,timestamptz,uuid,integer) to authenticated;
