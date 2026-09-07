create or replace function public.seller_import_batch_work_queue(
  p_batch_id uuid,
  p_need text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table(
  part_id uuid,
  title text,
  source_external_id text,
  category_name text,
  has_stock boolean,
  has_photo boolean,
  has_compatibility boolean,
  has_technical boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path=''
as $$
  with current_seller as (
    select s.id
    from public.sellers s
    where s.owner_id=auth.uid()
    limit 1
  ),
  drafts as (
    select
      p.id,
      p.title,
      p.source_external_id,
      c.name as category_name,
      (p.stock>0) as has_stock,
      exists(select 1 from public.part_images i where i.part_id=p.id) as has_photo,
      (
        p.donor_vehicle_id is not null
        or p.oem_number is not null
        or (p.manufacturer is not null and p.part_number is not null)
        or exists(select 1 from public.part_catalogue_fitments f where f.part_id=p.id)
      ) as has_compatibility,
      (
        not c.is_transmission_related
        or (p.gearbox_family is not null and p.gearbox_code is not null)
      ) as has_technical,
      p.created_at
    from public.parts p
    join current_seller s on s.id=p.seller_id
    join public.categories c on c.id=p.category_id
    where p.import_batch_id=p_batch_id
      and p.status='draft'::public.listing_status
  ),
  filtered as (
    select *
    from drafts d
    where
      p_need='all'
      or (p_need='ready' and d.has_stock and d.has_photo and d.has_compatibility and d.has_technical)
      or (p_need='photos' and not d.has_photo)
      or (p_need='compatibility' and not d.has_compatibility)
      or (p_need='technical' and not d.has_technical)
      or (p_need='stock' and not d.has_stock)
  )
  select
    f.id as part_id,
    f.title,
    f.source_external_id,
    f.category_name,
    f.has_stock,
    f.has_photo,
    f.has_compatibility,
    f.has_technical,
    count(*) over() as total_count
  from filtered f
  order by f.created_at,f.id
  limit least(greatest(coalesce(p_limit,25),1),100)
  offset greatest(coalesce(p_offset,0),0);
$$;

revoke all on function public.seller_import_batch_work_queue(uuid,text,integer,integer) from public;
revoke execute on function public.seller_import_batch_work_queue(uuid,text,integer,integer) from anon;
grant execute on function public.seller_import_batch_work_queue(uuid,text,integer,integer) to authenticated;
grant execute on function public.seller_import_batch_work_queue(uuid,text,integer,integer) to service_role;
