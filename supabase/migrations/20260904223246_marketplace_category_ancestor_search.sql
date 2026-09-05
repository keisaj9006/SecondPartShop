create or replace function public.category_descendant_ids(p_category_id uuid) returns table(id uuid) language sql stable set search_path='' as $$
 with recursive category_tree as (
  select c.id from public.categories c where c.id=p_category_id
  union all select child.id from public.categories child join category_tree parent on child.parent_id=parent.id
 ) select category_tree.id from category_tree;
$$;
revoke all on function public.category_descendant_ids(uuid) from public;
grant execute on function public.category_descendant_ids(uuid) to anon,authenticated;
