-- Decouple saved-search notifications from listing publication.
-- Bulk imports should enqueue work once per part, not synchronously scan every saved search.

create table if not exists private.saved_search_match_queue (
  part_id uuid primary key references public.parts(id) on delete cascade,
  enqueued_at timestamptz not null default now()
);

revoke all on private.saved_search_match_queue from public,anon,authenticated;

create or replace function private.notify_saved_search_matches_for_part(p_part_id uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  part_row record;
  saved record;
  q text;
  category_filter uuid;
  condition_filter text;
  min_price integer;
  max_price integer;
  collection_filter boolean;
  legacy_vehicle_filter uuid;
  variant_filter uuid;
  year_filter smallint;
  fuel_filter text;
  engine_filter integer;
  matches boolean;
  created_count integer:=0;
begin
  select p.*,s.owner_id as seller_owner_id
  into part_row
  from public.parts p
  join public.sellers s on s.id=p.seller_id
  where p.id=p_part_id
    and p.status='active'::public.listing_status;

  if not found then return 0; end if;

  for saved in
    select id,profile_id,name,search_params
    from public.saved_searches
    where profile_id is distinct from part_row.seller_owner_id
      and (
        nullif(search_params->>'condition','') is null
        or search_params->>'condition'=part_row.condition::text
      )
      and (
        coalesce(search_params->>'collection','')<>'1'
        or part_row.collection_available
      )
  loop
    matches:=true;
    q:=nullif(saved.search_params->>'q','');
    condition_filter:=nullif(saved.search_params->>'condition','');
    collection_filter:=coalesce(saved.search_params->>'collection','')='1';

    begin category_filter:=nullif(saved.search_params->>'category','')::uuid; exception when others then category_filter:=null; end;
    begin min_price:=round((nullif(saved.search_params->>'min',''))::numeric*100)::integer; exception when others then min_price:=null; end;
    begin max_price:=round((nullif(saved.search_params->>'max',''))::numeric*100)::integer; exception when others then max_price:=null; end;
    begin legacy_vehicle_filter:=nullif(saved.search_params->>'vehicle','')::uuid; exception when others then legacy_vehicle_filter:=null; end;
    begin variant_filter:=nullif(saved.search_params->>'cv','')::uuid; exception when others then variant_filter:=null; end;
    begin year_filter:=nullif(saved.search_params->>'cy','')::smallint; exception when others then year_filter:=null; end;
    fuel_filter:=nullif(saved.search_params->>'cf','');
    begin engine_filter:=nullif(saved.search_params->>'ce','')::integer; exception when others then engine_filter:=null; end;

    if min_price is not null and part_row.price_pence<min_price then matches:=false; end if;
    if matches and max_price is not null and part_row.price_pence>max_price then matches:=false; end if;

    if matches and q is not null and not exists (
      select 1 from public.marketplace_search_part_ids(q) r where r.part_id=part_row.id
    ) then matches:=false; end if;

    if matches and category_filter is not null and not exists (
      select 1 from public.category_descendant_ids(category_filter) c where c.id=part_row.category_id
    ) then matches:=false; end if;

    if matches and legacy_vehicle_filter is not null and not exists (
      select 1
      from public.marketplace_legacy_vehicle_compatibility(legacy_vehicle_filter,part_row.id)
    ) then matches:=false; end if;

    if matches and variant_filter is not null then
      if year_filter is null or not exists (
        select 1
        from public.marketplace_catalogue_compatibility(
          variant_filter,
          year_filter,
          fuel_filter,
          engine_filter,
          part_row.id
        )
      ) then
        matches:=false;
      end if;
    end if;

    if matches then
      insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
      values(
        saved.profile_id,
        'saved_search_match',
        'New match for '||left(saved.name,80),
        left(part_row.title,240),
        '/parts/'||part_row.slug,
        'saved-search:'||saved.id::text||':part:'||part_row.id::text
      )
      on conflict do nothing;

      if found then created_count:=created_count+1; end if;
    end if;
  end loop;

  return created_count;
end;
$$;

revoke all on function private.notify_saved_search_matches_for_part(uuid) from public,anon,authenticated;

create or replace function private.queue_saved_search_matches_after_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into private.saved_search_match_queue(part_id,enqueued_at)
  select n.id,now()
  from new_rows n
  where n.status='active'::public.listing_status
  on conflict(part_id) do update set enqueued_at=excluded.enqueued_at;
  return null;
end;
$$;

create or replace function private.queue_saved_search_matches_after_update()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into private.saved_search_match_queue(part_id,enqueued_at)
  select n.id,now()
  from new_rows n
  join old_rows o on o.id=n.id
  where n.status='active'::public.listing_status
    and o.status is distinct from 'active'::public.listing_status
  on conflict(part_id) do update set enqueued_at=excluded.enqueued_at;
  return null;
end;
$$;

revoke all on function private.queue_saved_search_matches_after_insert() from public,anon,authenticated;
revoke all on function private.queue_saved_search_matches_after_update() from public,anon,authenticated;

drop trigger if exists notify_saved_search_matches_trigger on public.parts;

drop trigger if exists queue_saved_search_matches_after_insert on public.parts;
create trigger queue_saved_search_matches_after_insert
after insert on public.parts
referencing new table as new_rows
for each statement
execute function private.queue_saved_search_matches_after_insert();

drop trigger if exists queue_saved_search_matches_after_update on public.parts;
create trigger queue_saved_search_matches_after_update
after update on public.parts
referencing old table as old_rows new table as new_rows
for each statement
execute function private.queue_saved_search_matches_after_update();

drop function if exists private.notify_saved_search_matches();

create or replace function private.process_saved_search_match_queue(p_limit integer default 50)
returns table(processed integer,notifications_created integer)
language plpgsql
security definer
set search_path=''
as $$
declare
  item record;
  processed_count integer:=0;
  notification_count integer:=0;
  created integer;
begin
  for item in
    select q.part_id
    from private.saved_search_match_queue q
    order by q.enqueued_at,q.part_id
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,50),250))
  loop
    delete from private.saved_search_match_queue
    where part_id=item.part_id;

    created:=private.notify_saved_search_matches_for_part(item.part_id);
    processed_count:=processed_count+1;
    notification_count:=notification_count+coalesce(created,0);
  end loop;

  return query select processed_count,notification_count;
end;
$$;

revoke all on function private.process_saved_search_match_queue(integer) from public,anon,authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname='secondpart-match-saved-searches'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end
$$;

select cron.schedule(
  'secondpart-match-saved-searches',
  '* * * * *',
  'select * from private.process_saved_search_match_queue(50);'
);
