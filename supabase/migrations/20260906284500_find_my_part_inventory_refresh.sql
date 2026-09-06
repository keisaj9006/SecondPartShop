-- Keep Find My Part routing current when seller inventory changes, without
-- re-ranking synchronously for every imported row.

create table if not exists private.part_request_refresh_queue (
  request_id uuid primary key references public.part_requests(id) on delete cascade,
  enqueued_at timestamptz not null default now()
);

revoke all on private.part_request_refresh_queue from public,anon,authenticated;

create or replace function private.refresh_seller_part_request_matches(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  request_status text;
begin
  select r.status into request_status
  from public.part_requests r
  where r.id=p_request_id;

  if request_status is distinct from 'open' then
    delete from public.seller_part_request_matches
    where request_id=p_request_id and status='open';
    return;
  end if;

  with recursive request_data as (
    select
      r.id,
      r.profile_id,
      r.category_id,
      r.catalogue_variant_id,
      r.year,
      r.fuel_type,
      r.engine_size_simple,
      r.oem_number,
      v.make as vehicle_make,
      v.model_family as vehicle_model
    from public.part_requests r
    left join public.vehicle_catalogue_variants v on v.id=r.catalogue_variant_id
    where r.id=p_request_id
  ),
  request_categories as (
    select r.category_id as id
    from request_data r
    where r.category_id is not null
    union all
    select c.id
    from public.categories c
    join request_categories rc on c.parent_id=rc.id
  ),
  features as (
    select
      s.id as seller_id,
      s.verified_at is not null as verified,
      (
        select count(*)
        from public.parts p
        where p.seller_id=s.id
          and p.status='active'::public.listing_status
      ) as active_inventory,
      (
        r.oem_number is not null
        and exists(
          select 1
          from public.parts p
          where p.seller_id=s.id
            and p.status in ('active'::public.listing_status,'draft'::public.listing_status)
            and p.oem_number is not null
            and regexp_replace(lower(p.oem_number),'[^a-z0-9]','','g')
                =regexp_replace(lower(r.oem_number),'[^a-z0-9]','','g')
        )
      ) as exact_oem,
      (
        r.catalogue_variant_id is not null
        and exists(
          select 1
          from public.parts p
          join public.part_catalogue_fitments f on f.part_id=p.id
          where p.seller_id=s.id
            and p.status in ('active'::public.listing_status,'draft'::public.listing_status)
            and f.variant_id=r.catalogue_variant_id
            and (r.year is null or f.year_from is null or r.year>=f.year_from)
            and (r.year is null or f.year_to is null or r.year<=f.year_to)
            and (r.fuel_type is null or f.fuel_type is null or upper(f.fuel_type)=upper(r.fuel_type))
            and (r.engine_size_simple is null or f.engine_size_simple is null or f.engine_size_simple=r.engine_size_simple)
        )
      ) as exact_fitment,
      (
        r.vehicle_make is not null
        and r.vehicle_model is not null
        and exists(
          select 1
          from public.donor_vehicles d
          where d.seller_id=s.id
            and regexp_replace(upper(d.make),'[^A-Z0-9]','','g')
                =regexp_replace(upper(r.vehicle_make),'[^A-Z0-9]','','g')
            and regexp_replace(upper(d.model),'[^A-Z0-9]','','g')
                =regexp_replace(upper(r.vehicle_model),'[^A-Z0-9]','','g')
            and (r.year is null or d.year=r.year)
            and (r.fuel_type is null or d.fuel_type is null or upper(d.fuel_type)=upper(r.fuel_type))
            and (r.engine_size_simple is null or d.engine_size_simple is null or d.engine_size_simple=r.engine_size_simple)
        )
      ) as donor_match,
      (
        r.category_id is not null
        and exists(
          select 1
          from public.parts p
          where p.seller_id=s.id
            and p.status in ('active'::public.listing_status,'draft'::public.listing_status)
            and p.category_id in (select rc.id from request_categories rc)
        )
      ) as category_match
    from public.sellers s
    cross join request_data r
    where s.owner_id is distinct from r.profile_id
  ),
  scored as (
    select
      f.seller_id,
      (case when f.exact_oem then 120 else 0 end)
      +(case when f.exact_fitment then 90 else 0 end)
      +(case when f.donor_match then 70 else 0 end)
      +(case when f.category_match then 35 else 0 end)
      +(case when f.active_inventory>0 then 5 else 0 end)
      +(case when f.verified then 3 else 0 end) as score,
      f.active_inventory,
      f.verified,
      array_remove(array[
        case when f.exact_oem then 'OE/OEM match' end,
        case when f.exact_fitment then 'Exact vehicle fitment in inventory' end,
        case when f.donor_match then 'Matching donor vehicle' end,
        case when f.category_match then 'Relevant category inventory' end
      ]::text[],null) as reasons
    from features f
    where f.exact_oem or f.exact_fitment or f.donor_match or f.category_match
  ),
  eligible as (
    select s.seller_id,s.score,s.reasons
    from scored s
    where not exists(
      select 1
      from public.seller_part_request_matches existing
      where existing.request_id=p_request_id
        and existing.seller_id=s.seller_id
        and existing.status in ('dismissed','responded')
    )
    order by s.score desc,s.verified desc,s.active_inventory desc,s.seller_id
    limit 12
  ),
  upserted as (
    insert into public.seller_part_request_matches(
      request_id,seller_id,match_score,match_reasons
    )
    select p_request_id,e.seller_id,e.score,e.reasons
    from eligible e
    on conflict(request_id,seller_id) do update
    set
      match_score=excluded.match_score,
      match_reasons=excluded.match_reasons,
      updated_at=now()
    returning seller_id
  )
  delete from public.seller_part_request_matches m
  where m.request_id=p_request_id
    and m.status='open'
    and not exists(select 1 from eligible e where e.seller_id=m.seller_id);
end;
$$;

create or replace function private.enqueue_part_request_refresh_for_part_signals(
  p_category_ids uuid[],
  p_oems text[],
  p_part_ids uuid[]
)
returns void
language sql
security definer
set search_path=''
as $$
  insert into private.part_request_refresh_queue(request_id,enqueued_at)
  with recursive category_ancestors as (
    select c.id,c.parent_id
    from public.categories c
    where c.id=any(coalesce(p_category_ids,array[]::uuid[]))
    union
    select parent.id,parent.parent_id
    from public.categories parent
    join category_ancestors child on child.parent_id=parent.id
  ),
  compact_oems as (
    select distinct regexp_replace(lower(value),'[^a-z0-9]','','g') as value
    from unnest(coalesce(p_oems,array[]::text[])) value
    where value is not null and btrim(value)<>''
  ),
  fitment_variants as (
    select distinct f.variant_id
    from public.part_catalogue_fitments f
    where f.part_id=any(coalesce(p_part_ids,array[]::uuid[]))
  )
  select distinct r.id,now()
  from public.part_requests r
  where r.status='open'
    and (
      (r.category_id is not null and r.category_id in (select id from category_ancestors))
      or (
        r.oem_number is not null
        and regexp_replace(lower(r.oem_number),'[^a-z0-9]','','g')
            in (select value from compact_oems)
      )
      or (
        r.catalogue_variant_id is not null
        and r.catalogue_variant_id in (select variant_id from fitment_variants)
      )
    )
  on conflict(request_id) do update set enqueued_at=excluded.enqueued_at;
$$;

create or replace function private.queue_requests_after_parts_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  categories uuid[];
  oems text[];
  part_ids uuid[];
begin
  select
    array_agg(distinct n.category_id) filter(where n.category_id is not null),
    array_agg(distinct n.oem_number) filter(where n.oem_number is not null),
    array_agg(distinct n.id)
  into categories,oems,part_ids
  from new_rows n
  where n.status in ('active'::public.listing_status,'draft'::public.listing_status);

  perform private.enqueue_part_request_refresh_for_part_signals(categories,oems,part_ids);
  return null;
end;
$$;

create or replace function private.queue_requests_after_parts_delete()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  categories uuid[];
  oems text[];
begin
  select
    array_agg(distinct o.category_id) filter(where o.category_id is not null),
    array_agg(distinct o.oem_number) filter(where o.oem_number is not null)
  into categories,oems
  from old_rows o
  where o.status in ('active'::public.listing_status,'draft'::public.listing_status);

  perform private.enqueue_part_request_refresh_for_part_signals(categories,oems,array[]::uuid[]);
  return null;
end;
$$;

create or replace function private.queue_requests_after_parts_update()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  categories uuid[];
  oems text[];
  part_ids uuid[];
begin
  if not exists(
    select 1
    from old_rows o
    join new_rows n on n.id=o.id
    where o.status is distinct from n.status
       or o.category_id is distinct from n.category_id
       or o.oem_number is distinct from n.oem_number
       or o.seller_id is distinct from n.seller_id
  ) then
    return null;
  end if;

  select
    array_agg(distinct x.category_id) filter(where x.category_id is not null),
    array_agg(distinct x.oem_number) filter(where x.oem_number is not null),
    array_agg(distinct x.id)
  into categories,oems,part_ids
  from (
    select o.id,o.category_id,o.oem_number
    from old_rows o
    where o.status in ('active'::public.listing_status,'draft'::public.listing_status)
    union all
    select n.id,n.category_id,n.oem_number
    from new_rows n
    where n.status in ('active'::public.listing_status,'draft'::public.listing_status)
  ) x;

  perform private.enqueue_part_request_refresh_for_part_signals(categories,oems,part_ids);
  return null;
end;
$$;

drop trigger if exists queue_find_my_part_after_parts_insert on public.parts;
create trigger queue_find_my_part_after_parts_insert
after insert on public.parts
referencing new table as new_rows
for each statement execute function private.queue_requests_after_parts_insert();

drop trigger if exists queue_find_my_part_after_parts_delete on public.parts;
create trigger queue_find_my_part_after_parts_delete
after delete on public.parts
referencing old table as old_rows
for each statement execute function private.queue_requests_after_parts_delete();

drop trigger if exists queue_find_my_part_after_parts_update on public.parts;
create trigger queue_find_my_part_after_parts_update
after update on public.parts
referencing old table as old_rows new table as new_rows
for each statement execute function private.queue_requests_after_parts_update();

create or replace function private.queue_requests_after_fitments_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into private.part_request_refresh_queue(request_id,enqueued_at)
  select distinct r.id,now()
  from public.part_requests r
  where r.status='open'
    and r.catalogue_variant_id is not null
    and r.catalogue_variant_id in (
      select variant_id from old_rows
      union
      select variant_id from new_rows
    )
  on conflict(request_id) do update set enqueued_at=excluded.enqueued_at;
  return null;
end;
$$;

create or replace function private.queue_requests_after_fitments_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into private.part_request_refresh_queue(request_id,enqueued_at)
  select distinct r.id,now()
  from public.part_requests r
  join new_rows n on n.variant_id=r.catalogue_variant_id
  where r.status='open'
  on conflict(request_id) do update set enqueued_at=excluded.enqueued_at;
  return null;
end;
$$;

create or replace function private.queue_requests_after_fitments_delete()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into private.part_request_refresh_queue(request_id,enqueued_at)
  select distinct r.id,now()
  from public.part_requests r
  join old_rows o on o.variant_id=r.catalogue_variant_id
  where r.status='open'
  on conflict(request_id) do update set enqueued_at=excluded.enqueued_at;
  return null;
end;
$$;

drop trigger if exists queue_find_my_part_after_fitments_insert on public.part_catalogue_fitments;
create trigger queue_find_my_part_after_fitments_insert
after insert on public.part_catalogue_fitments
referencing new table as new_rows
for each statement execute function private.queue_requests_after_fitments_insert();

drop trigger if exists queue_find_my_part_after_fitments_delete on public.part_catalogue_fitments;
create trigger queue_find_my_part_after_fitments_delete
after delete on public.part_catalogue_fitments
referencing old table as old_rows
for each statement execute function private.queue_requests_after_fitments_delete();

drop trigger if exists queue_find_my_part_after_fitments_update on public.part_catalogue_fitments;
create trigger queue_find_my_part_after_fitments_update
after update on public.part_catalogue_fitments
referencing old table as old_rows new table as new_rows
for each statement execute function private.queue_requests_after_fitments_change();

create or replace function private.queue_requests_for_donor_rows(
  p_use_old boolean,
  p_use_new boolean
)
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  return null;
end;
$$;

create or replace function private.queue_requests_after_donors_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into private.part_request_refresh_queue(request_id,enqueued_at)
  select distinct r.id,now()
  from public.part_requests r
  join public.vehicle_catalogue_variants v on v.id=r.catalogue_variant_id
  join new_rows d
    on regexp_replace(upper(d.make),'[^A-Z0-9]','','g')=regexp_replace(upper(v.make),'[^A-Z0-9]','','g')
   and regexp_replace(upper(d.model),'[^A-Z0-9]','','g')=regexp_replace(upper(v.model_family),'[^A-Z0-9]','','g')
  where r.status='open'
  on conflict(request_id) do update set enqueued_at=excluded.enqueued_at;
  return null;
end;
$$;

create or replace function private.queue_requests_after_donors_delete()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into private.part_request_refresh_queue(request_id,enqueued_at)
  select distinct r.id,now()
  from public.part_requests r
  join public.vehicle_catalogue_variants v on v.id=r.catalogue_variant_id
  join old_rows d
    on regexp_replace(upper(d.make),'[^A-Z0-9]','','g')=regexp_replace(upper(v.make),'[^A-Z0-9]','','g')
   and regexp_replace(upper(d.model),'[^A-Z0-9]','','g')=regexp_replace(upper(v.model_family),'[^A-Z0-9]','','g')
  where r.status='open'
  on conflict(request_id) do update set enqueued_at=excluded.enqueued_at;
  return null;
end;
$$;

create or replace function private.queue_requests_after_donors_update()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if not exists(
    select 1
    from old_rows o
    join new_rows n on n.id=o.id
    where o.seller_id is distinct from n.seller_id
       or o.make is distinct from n.make
       or o.model is distinct from n.model
       or o.year is distinct from n.year
       or o.fuel_type is distinct from n.fuel_type
       or o.engine_size_simple is distinct from n.engine_size_simple
  ) then
    return null;
  end if;

  insert into private.part_request_refresh_queue(request_id,enqueued_at)
  select distinct r.id,now()
  from public.part_requests r
  join public.vehicle_catalogue_variants v on v.id=r.catalogue_variant_id
  where r.status='open'
    and (
      exists(
        select 1 from old_rows d
        where regexp_replace(upper(d.make),'[^A-Z0-9]','','g')=regexp_replace(upper(v.make),'[^A-Z0-9]','','g')
          and regexp_replace(upper(d.model),'[^A-Z0-9]','','g')=regexp_replace(upper(v.model_family),'[^A-Z0-9]','','g')
      )
      or exists(
        select 1 from new_rows d
        where regexp_replace(upper(d.make),'[^A-Z0-9]','','g')=regexp_replace(upper(v.make),'[^A-Z0-9]','','g')
          and regexp_replace(upper(d.model),'[^A-Z0-9]','','g')=regexp_replace(upper(v.model_family),'[^A-Z0-9]','','g')
      )
    )
  on conflict(request_id) do update set enqueued_at=excluded.enqueued_at;
  return null;
end;
$$;

drop trigger if exists queue_find_my_part_after_donors_insert on public.donor_vehicles;
create trigger queue_find_my_part_after_donors_insert
after insert on public.donor_vehicles
referencing new table as new_rows
for each statement execute function private.queue_requests_after_donors_insert();

drop trigger if exists queue_find_my_part_after_donors_delete on public.donor_vehicles;
create trigger queue_find_my_part_after_donors_delete
after delete on public.donor_vehicles
referencing old table as old_rows
for each statement execute function private.queue_requests_after_donors_delete();

drop trigger if exists queue_find_my_part_after_donors_update on public.donor_vehicles;
create trigger queue_find_my_part_after_donors_update
after update on public.donor_vehicles
referencing old table as old_rows new table as new_rows
for each statement execute function private.queue_requests_after_donors_update();

create or replace function private.process_part_request_refresh_queue(p_limit integer default 200)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  item record;
  processed integer:=0;
begin
  for item in
    select q.request_id
    from private.part_request_refresh_queue q
    order by q.enqueued_at,q.request_id
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,200),1000))
  loop
    delete from private.part_request_refresh_queue
    where request_id=item.request_id;

    perform private.refresh_seller_part_request_matches(item.request_id);
    processed:=processed+1;
  end loop;

  return processed;
end;
$$;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname='secondpart-refresh-find-my-part'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end
$$;

select cron.schedule(
  'secondpart-refresh-find-my-part',
  '* * * * *',
  'select private.process_part_request_refresh_queue(200);'
);
