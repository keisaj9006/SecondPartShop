create index if not exists parts_seller_status_created_id_idx
  on public.parts(seller_id,status,created_at desc,id);

create or replace function public.get_public_seller_inventory_summary(p_seller_id uuid)
returns table(
  active_count bigint,
  tested_count bigint,
  collection_count bigint,
  warranty_count bigint,
  category_names text[]
)
language sql
stable
security definer
set search_path=''
as $$
  select
    count(*)::bigint as active_count,
    count(*) filter(
      where p.testing_status in (
        'tested_working',
        'removed_from_running_vehicle'
      )
    )::bigint as tested_count,
    count(*) filter(where p.collection_available)::bigint as collection_count,
    count(*) filter(where p.warranty_days>0)::bigint as warranty_count,
    coalesce(
      (
        select array_agg(category_name order by part_count desc,category_name)
        from (
          select c.name as category_name,count(*)::bigint as part_count
          from public.parts p2
          join public.categories c on c.id=p2.category_id
          where p2.seller_id=p_seller_id
            and p2.status='active'::public.listing_status
          group by c.name
          order by count(*) desc,c.name
          limit 8
        ) ranked_categories
      ),
      array[]::text[]
    ) as category_names
  from public.parts p
  where p.seller_id=p_seller_id
    and p.status='active'::public.listing_status;
$$;

revoke all on function public.get_public_seller_inventory_summary(uuid) from public;
grant execute on function public.get_public_seller_inventory_summary(uuid) to anon,authenticated;
