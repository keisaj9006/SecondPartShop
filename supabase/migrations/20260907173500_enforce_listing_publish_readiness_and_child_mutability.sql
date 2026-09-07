create or replace function private.enforce_listing_activation_readiness()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  category_row record;
begin
  if new.status<>'active'::public.listing_status then
    return new;
  end if;

  if current_user in ('postgres','service_role') then
    return new;
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

drop trigger if exists parts_enforce_activation_readiness_insert on public.parts;
create trigger parts_enforce_activation_readiness_insert
before insert on public.parts
for each row
execute function private.enforce_listing_activation_readiness();

drop trigger if exists parts_enforce_activation_readiness_update on public.parts;
create trigger parts_enforce_activation_readiness_update
before update of status,category_id,donor_vehicle_id,oem_number,manufacturer,part_number,gearbox_family,gearbox_code
on public.parts
for each row
execute function private.enforce_listing_activation_readiness();

create or replace function private.prevent_last_active_listing_image_delete()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  part_status public.listing_status;
  image_count integer;
begin
  if auth.uid() is null or private.is_admin() then
    return old;
  end if;

  select p.status
  into part_status
  from public.parts p
  where p.id=old.part_id;

  if part_status='active'::public.listing_status then
    select count(*)
    into image_count
    from public.part_images i
    where i.part_id=old.part_id;

    if image_count<=1 then
      raise exception 'An active listing must keep at least one real product photo.';
    end if;
  end if;

  return old;
end;
$$;

drop trigger if exists part_images_keep_one_for_active_listing on public.part_images;
create trigger part_images_keep_one_for_active_listing
before delete on public.part_images
for each row
execute function private.prevent_last_active_listing_image_delete();

drop policy if exists "images owner create" on public.part_images;
create policy "images owner create" on public.part_images
for insert to authenticated
with check (
  private.is_admin()
  or (
    private.owns_part(part_id)
    and exists(
      select 1
      from public.parts p
      where p.id=part_id
        and p.status<>'reserved'::public.listing_status
    )
  )
);

drop policy if exists "images owner update" on public.part_images;
create policy "images owner update" on public.part_images
for update to authenticated
using (
  private.is_admin()
  or (
    private.owns_part(part_id)
    and exists(
      select 1
      from public.parts p
      where p.id=part_id
        and p.status<>'reserved'::public.listing_status
    )
  )
)
with check (
  private.is_admin()
  or (
    private.owns_part(part_id)
    and exists(
      select 1
      from public.parts p
      where p.id=part_id
        and p.status<>'reserved'::public.listing_status
    )
  )
);

drop policy if exists "images owner delete" on public.part_images;
create policy "images owner delete" on public.part_images
for delete to authenticated
using (
  private.is_admin()
  or (
    private.owns_part(part_id)
    and exists(
      select 1
      from public.parts p
      where p.id=part_id
        and p.status<>'reserved'::public.listing_status
    )
  )
);

create or replace function public.replace_part_catalogue_fitments(
  p_part_id uuid,
  p_fitments jsonb
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  inserted_count integer;
  part_row record;
begin
  if jsonb_typeof(p_fitments) is distinct from 'array' then
    raise exception 'Fitments must be a JSON array.';
  end if;

  if jsonb_array_length(p_fitments)>20 then
    raise exception 'A listing can have at most 20 catalogue fitments.';
  end if;

  if not (private.owns_part(p_part_id) or private.is_admin()) then
    raise exception 'Not allowed to edit catalogue fitments.';
  end if;

  select
    p.id,p.status,p.donor_vehicle_id,p.oem_number,p.manufacturer,p.part_number
  into part_row
  from public.parts p
  where p.id=p_part_id;

  if part_row.id is null then
    raise exception 'Listing not found.';
  end if;

  if part_row.status='reserved'::public.listing_status and not private.is_admin() then
    raise exception 'This listing is temporarily reserved in an active checkout.';
  end if;

  if part_row.status='active'::public.listing_status
     and jsonb_array_length(p_fitments)=0
     and part_row.donor_vehicle_id is null
     and part_row.oem_number is null
     and not (part_row.manufacturer is not null and part_row.part_number is not null) then
    raise exception 'An active listing must keep compatibility or part identity evidence.';
  end if;

  delete from public.part_catalogue_fitments
  where part_id=p_part_id;

  if jsonb_array_length(p_fitments)=0 then
    return;
  end if;

  insert into public.part_catalogue_fitments(
    part_id,variant_id,year_from,year_to,fuel_type,engine_size_simple,notes
  )
  select
    p_part_id,
    x.variant_id,
    x.year_value,
    x.year_value,
    nullif(x.fuel_type,''),
    x.engine_size_simple,
    nullif(x.notes,'')
  from jsonb_to_recordset(p_fitments) as x(
    variant_id uuid,
    year_value smallint,
    fuel_type text,
    engine_size_simple integer,
    notes text
  )
  join public.vehicle_catalogue_variants v
    on v.id=x.variant_id
   and v.provider='dft'
   and v.body_type='Cars'
  join public.vehicle_catalogue_years y
    on y.variant_id=x.variant_id
   and y.year_first_used=x.year_value
  where
    (
      x.fuel_type is null
      and x.engine_size_simple is null
    )
    or exists(
      select 1
      from public.vehicle_catalogue_engines e
      where e.variant_id=x.variant_id
        and e.fuel_type=x.fuel_type
        and (
          x.engine_size_simple is null
          or e.engine_size_simple=x.engine_size_simple
        )
    );

  get diagnostics inserted_count=row_count;

  if inserted_count<>jsonb_array_length(p_fitments) then
    raise exception 'One or more vehicle fitments are invalid or not in the current catalogue.';
  end if;
end;
$$;

revoke all on function public.replace_part_catalogue_fitments(uuid,jsonb) from public;
revoke execute on function public.replace_part_catalogue_fitments(uuid,jsonb) from anon;
grant execute on function public.replace_part_catalogue_fitments(uuid,jsonb) to authenticated;
grant execute on function public.replace_part_catalogue_fitments(uuid,jsonb) to service_role;

drop policy if exists "catalogue fitments owner create" on public.part_catalogue_fitments;
create policy "catalogue fitments owner create" on public.part_catalogue_fitments
for insert to authenticated
with check (
  private.is_admin()
  or (
    private.owns_part(part_id)
    and exists(
      select 1
      from public.parts p
      where p.id=part_id
        and p.status not in ('active'::public.listing_status,'reserved'::public.listing_status)
    )
  )
);

drop policy if exists "catalogue fitments owner update" on public.part_catalogue_fitments;
create policy "catalogue fitments owner update" on public.part_catalogue_fitments
for update to authenticated
using (
  private.is_admin()
  or (
    private.owns_part(part_id)
    and exists(
      select 1
      from public.parts p
      where p.id=part_id
        and p.status not in ('active'::public.listing_status,'reserved'::public.listing_status)
    )
  )
)
with check (
  private.is_admin()
  or (
    private.owns_part(part_id)
    and exists(
      select 1
      from public.parts p
      where p.id=part_id
        and p.status not in ('active'::public.listing_status,'reserved'::public.listing_status)
    )
  )
);

drop policy if exists "catalogue fitments owner delete" on public.part_catalogue_fitments;
create policy "catalogue fitments owner delete" on public.part_catalogue_fitments
for delete to authenticated
using (
  private.is_admin()
  or (
    private.owns_part(part_id)
    and exists(
      select 1
      from public.parts p
      where p.id=part_id
        and p.status not in ('active'::public.listing_status,'reserved'::public.listing_status)
    )
  )
);
