-- Cursor pagination V2 for all non-search marketplace browse sorts.
-- Keeps deep pagination O(page size) for newest, price, delivery and warranty views.

drop index if exists public.parts_active_price_idx;
create index parts_active_price_idx
  on public.parts(price_pence asc,created_at desc,id desc)
  where status='active'::public.listing_status;

create index if not exists parts_active_price_desc_cursor_idx
  on public.parts(price_pence desc,created_at desc,id desc)
  where status='active'::public.listing_status;

drop index if exists public.parts_active_delivery_idx;
create index parts_active_delivery_idx
  on public.parts(delivery_days_min asc,created_at desc,id desc)
  where status='active'::public.listing_status;

drop index if exists public.parts_active_warranty_idx;
create index parts_active_warranty_idx
  on public.parts(warranty_days desc,created_at desc,id desc)
  where status='active'::public.listing_status;

create or replace function public.marketplace_browse_cursor_page_v2(
  p_sort text default 'best',
  p_category_ids uuid[] default null,
  p_condition text default null,
  p_min_price_pence integer default null,
  p_max_price_pence integer default null,
  p_collection_only boolean default false,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_after_sort_value integer default null,
  p_limit integer default 24
)
returns table(part_id uuid,created_at timestamptz,sort_value integer)
language plpgsql
stable
set search_path=''
as $$
declare
  v_limit integer:=greatest(2,least(coalesce(p_limit,24),61));
begin
  if p_sort='price_asc' then
    return query
    select p.id,p.created_at,p.price_pence
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
        or p_after_sort_value is null
        or p.price_pence>p_after_sort_value
        or (
          p.price_pence=p_after_sort_value
          and (p.created_at,p.id)<(p_after_created_at,p_after_id)
        )
      )
    order by p.price_pence asc,p.created_at desc,p.id desc
    limit v_limit;
    return;
  end if;

  if p_sort='price_desc' then
    return query
    select p.id,p.created_at,p.price_pence
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
        or p_after_sort_value is null
        or p.price_pence<p_after_sort_value
        or (
          p.price_pence=p_after_sort_value
          and (p.created_at,p.id)<(p_after_created_at,p_after_id)
        )
      )
    order by p.price_pence desc,p.created_at desc,p.id desc
    limit v_limit;
    return;
  end if;

  if p_sort='delivery' then
    return query
    select p.id,p.created_at,p.delivery_days_min
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
        or (
          p_after_sort_value is null
          and p.delivery_days_min is null
          and (p.created_at,p.id)<(p_after_created_at,p_after_id)
        )
        or (
          p_after_sort_value is not null
          and (
            p.delivery_days_min is null
            or p.delivery_days_min>p_after_sort_value
            or (
              p.delivery_days_min=p_after_sort_value
              and (p.created_at,p.id)<(p_after_created_at,p_after_id)
            )
          )
        )
      )
    order by p.delivery_days_min asc nulls last,p.created_at desc,p.id desc
    limit v_limit;
    return;
  end if;

  if p_sort='warranty' then
    return query
    select p.id,p.created_at,p.warranty_days
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
        or p_after_sort_value is null
        or p.warranty_days<p_after_sort_value
        or (
          p.warranty_days=p_after_sort_value
          and (p.created_at,p.id)<(p_after_created_at,p_after_id)
        )
      )
    order by p.warranty_days desc,p.created_at desc,p.id desc
    limit v_limit;
    return;
  end if;

  return query
  select p.id,p.created_at,null::integer
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
  limit v_limit;
end;
$$;

revoke all on function public.marketplace_browse_cursor_page_v2(text,uuid[],text,integer,integer,boolean,timestamptz,uuid,integer,integer) from public;
grant execute on function public.marketplace_browse_cursor_page_v2(text,uuid[],text,integer,integer,boolean,timestamptz,uuid,integer,integer) to anon,authenticated;
