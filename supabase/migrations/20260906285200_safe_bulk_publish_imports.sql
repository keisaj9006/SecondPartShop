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
      exists(
        select 1 from public.part_images i where i.part_id=p.id
      ) as has_photo,
      (
        p.donor_vehicle_id is not null
        or p.oem_number is not null
        or (p.manufacturer is not null and p.part_number is not null)
        or exists(
          select 1 from public.part_catalogue_fitments f where f.part_id=p.id
        )
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
    count(*)::integer as total_drafts,
    count(*) filter(where has_photo and has_compatibility and has_technical)::integer as ready_drafts,
    count(*) filter(where not has_photo)::integer as needs_photos,
    count(*) filter(where not has_compatibility)::integer as needs_compatibility,
    count(*) filter(where not has_technical)::integer as needs_technical
  from drafts;
$$;

revoke all on function public.seller_import_batch_readiness(uuid) from public;
grant execute on function public.seller_import_batch_readiness(uuid) to authenticated;

create or replace function public.publish_ready_import_batch(p_batch_id uuid)
returns integer
language sql
volatile
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
      and p.stock>=0
  ),
  published as (
    update public.parts p
    set status='active'::public.listing_status,
        updated_at=now()
    from ready r
    where p.id=r.id
    returning p.id
  )
  select count(*)::integer from published;
$$;

revoke all on function public.publish_ready_import_batch(uuid) from public;
grant execute on function public.publish_ready_import_batch(uuid) to authenticated;
