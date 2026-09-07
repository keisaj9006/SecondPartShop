alter table public.parts
  drop constraint if exists parts_active_requires_stock;

alter table public.parts
  add constraint parts_active_requires_stock
  check (status<>'active'::public.listing_status or stock>0);

create or replace function public.seller_import_batch_readiness(p_batch_id uuid)
returns table(
  total_drafts integer,
  ready_drafts integer,
  needs_photos integer,
  needs_compatibility integer,
  needs_technical integer
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
      ) as has_technical
    from public.parts p
    join current_seller s on s.id=p.seller_id
    join public.categories c on c.id=p.category_id
    where p.import_batch_id=p_batch_id
      and p.status='draft'::public.listing_status
  )
  select
    count(*)::integer,
    count(*) filter(where has_stock and has_photo and has_compatibility and has_technical)::integer,
    count(*) filter(where not has_photo)::integer,
    count(*) filter(where not has_compatibility)::integer,
    count(*) filter(where not has_technical)::integer
  from drafts;
$$;

create or replace function public.publish_ready_import_batch(p_batch_id uuid)
returns integer
language sql
security definer
set search_path=''
as $$
  with current_seller as (
    select s.id
    from public.sellers s
    where s.owner_id=auth.uid()
    limit 1
  ),
  ready as (
    select p.id
    from public.parts p
    join current_seller s on s.id=p.seller_id
    join public.categories c on c.id=p.category_id
    where p.import_batch_id=p_batch_id
      and p.status='draft'::public.listing_status
      and p.stock>0
      and c.is_selectable
      and exists(select 1 from public.part_images i where i.part_id=p.id)
      and (
        p.donor_vehicle_id is not null
        or p.oem_number is not null
        or (p.manufacturer is not null and p.part_number is not null)
        or exists(select 1 from public.part_catalogue_fitments f where f.part_id=p.id)
      )
      and (
        not c.is_transmission_related
        or (p.gearbox_family is not null and p.gearbox_code is not null)
      )
      and char_length(btrim(p.title))>=5
      and char_length(btrim(p.description))>=20
      and p.price_pence>=0
  ),
  published as (
    update public.parts p
    set status='active'::public.listing_status,updated_at=now()
    from ready r
    where p.id=r.id
    returning p.id
  )
  select count(*)::integer from published;
$$;
