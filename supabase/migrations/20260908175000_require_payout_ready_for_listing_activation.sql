create or replace function private.enforce_listing_activation_readiness()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  category_row record;
  activating boolean;
begin
  if new.status<>'active'::public.listing_status then
    return new;
  end if;

  -- Trusted service-role imports/commerce maintenance are handled separately.
  if current_user in ('postgres','service_role') then
    return new;
  end if;

  activating:=case
    when tg_op='INSERT' then true
    else old.status is distinct from 'active'::public.listing_status
  end;

  if activating and not public.seller_checkout_ready(new.seller_id) then
    raise exception 'Complete seller payment and payout setup before publishing an active listing.';
  end if;

  select c.is_selectable,c.is_transmission_related
  into category_row
  from public.categories c
  where c.id=new.category_id;

  if category_row.is_selectable is distinct from true then
    raise exception 'Choose a specific selectable category before publishing.';
  end if;

  if new.stock<1 then
    raise exception 'Active listings require stock.';
  end if;

  if not exists(
    select 1
    from public.part_images i
    where i.part_id=new.id
  ) then
    raise exception 'Add at least one real product photo before publishing.';
  end if;

  if not (
    new.donor_vehicle_id is not null
    or new.oem_number is not null
    or (new.manufacturer is not null and new.part_number is not null)
    or exists(
      select 1
      from public.part_catalogue_fitments f
      where f.part_id=new.id
    )
  ) then
    raise exception 'Add compatibility or part identity evidence before publishing.';
  end if;

  if category_row.is_transmission_related
     and (new.gearbox_family is null or new.gearbox_code is null) then
    raise exception 'Transmission listings require gearbox family and code before publishing.';
  end if;

  return new;
end;
$$;
