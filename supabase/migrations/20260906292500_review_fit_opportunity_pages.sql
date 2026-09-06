create or replace function public.get_review_opportunities_page(
  p_limit integer default 30,
  p_offset integer default 0
)
returns table(
  order_item_id uuid,
  direction text,
  counterpart_profile_id uuid,
  counterpart_handle text,
  counterpart_display_name text,
  part_title text,
  funds_released_at timestamptz,
  existing_review_id uuid
)
language sql
stable
security definer
set search_path=''
as $$
  select *
  from public.get_review_opportunities()
  order by funds_released_at desc,order_item_id
  limit greatest(1,least(coalesce(p_limit,30),60))+1
  offset greatest(0,coalesce(p_offset,0));
$$;

revoke all on function public.get_review_opportunities_page(integer,integer) from public,anon;
grant execute on function public.get_review_opportunities_page(integer,integer) to authenticated;

create or replace function public.get_verified_fit_opportunities_page(
  p_limit integer default 30,
  p_offset integer default 0
)
returns table(
  order_item_id uuid,
  part_id uuid,
  part_title text,
  part_slug text,
  variant_id uuid,
  vehicle_make text,
  vehicle_model text,
  vehicle_variant text,
  vehicle_year smallint,
  vehicle_fuel text,
  vehicle_engine integer,
  existing_result text,
  existing_notes text,
  funds_released_at timestamptz
)
language sql
stable
security definer
set search_path=''
as $$
  select *
  from public.get_verified_fit_opportunities()
  order by funds_released_at desc,order_item_id
  limit greatest(1,least(coalesce(p_limit,30),60))+1
  offset greatest(0,coalesce(p_offset,0));
$$;

revoke all on function public.get_verified_fit_opportunities_page(integer,integer) from public,anon;
grant execute on function public.get_verified_fit_opportunities_page(integer,integer) to authenticated;
