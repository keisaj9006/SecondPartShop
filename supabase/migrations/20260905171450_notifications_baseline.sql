alter table public.parts
  add column if not exists source_request_id uuid references public.part_requests(id) on delete set null;

create index if not exists parts_source_request_idx on public.parts(source_request_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('seller_part_request','buyer_part_match','saved_search_match','account')),
  title text not null,
  body text,
  href text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists notifications_profile_dedupe_unique
  on public.notifications(profile_id,dedupe_key)
  where dedupe_key is not null;

create index if not exists notifications_profile_created_idx
  on public.notifications(profile_id,created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read"
  on public.notifications for select
  to authenticated
  using ((select auth.uid())=profile_id);

drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update"
  on public.notifications for update
  to authenticated
  using ((select auth.uid())=profile_id)
  with check ((select auth.uid())=profile_id);

grant select,update on public.notifications to authenticated;

create or replace function private.notify_sellers_for_part_request()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  select distinct
    s.owner_id,
    'seller_part_request',
    'New buyer part request',
    left(new.query_text,240),
    '/dashboard/requests',
    'seller-request:'||new.id::text||':seller:'||s.id::text
  from public.sellers s
  where s.owner_id is not null
    and (
      new.category_id is null
      or exists (
        select 1 from public.parts p
        where p.seller_id=s.id
          and p.status='active'
          and p.category_id=new.category_id
      )
    )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists notify_sellers_for_part_request_trigger on public.part_requests;
create trigger notify_sellers_for_part_request_trigger
after insert on public.part_requests
for each row
when (new.status='open')
execute function private.notify_sellers_for_part_request();

create or replace function private.notify_buyer_for_request_listing()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  buyer_id uuid;
begin
  if new.source_request_id is null or new.status<>'active' then
    return new;
  end if;
  if tg_op='UPDATE' and old.status='active' and old.source_request_id is not distinct from new.source_request_id then
    return new;
  end if;

  select profile_id into buyer_id
  from public.part_requests
  where id=new.source_request_id and status='open';

  if buyer_id is null then
    return new;
  end if;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(
    buyer_id,
    'buyer_part_match',
    'A seller listed a part for your request',
    left(new.title,240),
    '/parts/'||new.slug,
    'request-match:'||new.source_request_id::text||':part:'||new.id::text
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists notify_buyer_for_request_listing_trigger on public.parts;
create trigger notify_buyer_for_request_listing_trigger
after insert or update of status,source_request_id on public.parts
for each row execute function private.notify_buyer_for_request_listing();

create or replace function private.notify_saved_search_matches()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  saved record;
  q text;
  category_filter uuid;
  condition_filter text;
  min_price integer;
  max_price integer;
  collection_filter boolean;
  variant_filter uuid;
  year_filter smallint;
  fuel_filter text;
  engine_filter integer;
  matches boolean;
begin
  if new.status<>'active' then return new; end if;
  if tg_op='UPDATE' and old.status='active' then return new; end if;

  for saved in
    select id,profile_id,name,search_params
    from public.saved_searches
  loop
    matches:=true;
    q:=nullif(saved.search_params->>'q','');
    condition_filter:=nullif(saved.search_params->>'condition','');
    collection_filter:=coalesce(saved.search_params->>'collection','')='1';

    begin category_filter:=nullif(saved.search_params->>'category','')::uuid; exception when others then category_filter:=null; end;
    begin min_price:=round((nullif(saved.search_params->>'min',''))::numeric*100)::integer; exception when others then min_price:=null; end;
    begin max_price:=round((nullif(saved.search_params->>'max',''))::numeric*100)::integer; exception when others then max_price:=null; end;
    begin variant_filter:=nullif(saved.search_params->>'cv','')::uuid; exception when others then variant_filter:=null; end;
    begin year_filter:=nullif(saved.search_params->>'cy','')::smallint; exception when others then year_filter:=null; end;
    fuel_filter:=nullif(saved.search_params->>'cf','');
    begin engine_filter:=nullif(saved.search_params->>'ce','')::integer; exception when others then engine_filter:=null; end;

    if q is not null and not exists (
      select 1 from public.marketplace_search_part_ids(q) r where r.part_id=new.id
    ) then matches:=false; end if;

    if matches and category_filter is not null and not exists (
      select 1 from public.category_descendant_ids(category_filter) c where c.id=new.category_id
    ) then matches:=false; end if;

    if matches and condition_filter is not null and new.condition::text<>condition_filter then matches:=false; end if;
    if matches and min_price is not null and new.price_pence<min_price then matches:=false; end if;
    if matches and max_price is not null and new.price_pence>max_price then matches:=false; end if;
    if matches and collection_filter and not new.collection_available then matches:=false; end if;

    if matches and variant_filter is not null and not exists (
      select 1 from public.part_catalogue_fitments f
      where f.part_id=new.id
        and f.variant_id=variant_filter
        and (year_filter is null or (f.year_from<=year_filter and f.year_to>=year_filter))
        and (fuel_filter is null or f.fuel_type=fuel_filter)
        and (engine_filter is null or f.engine_size_simple=engine_filter)
    ) then matches:=false; end if;

    if matches then
      insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
      values(
        saved.profile_id,
        'saved_search_match',
        'New match for '||left(saved.name,80),
        left(new.title,240),
        '/parts/'||new.slug,
        'saved-search:'||saved.id::text||':part:'||new.id::text
      )
      on conflict do nothing;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists notify_saved_search_matches_trigger on public.parts;
create trigger notify_saved_search_matches_trigger
after insert or update of status on public.parts
for each row execute function private.notify_saved_search_matches();
