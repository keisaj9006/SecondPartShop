create table if not exists public.garage_partners (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(btrim(business_name)) between 2 and 140),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  location text not null check (char_length(btrim(location)) between 2 and 120),
  postcode text not null check (char_length(btrim(postcode)) between 2 and 20),
  latitude double precision,
  longitude double precision,
  description text not null check (char_length(btrim(description)) between 20 and 2000),
  customer_supplied_parts boolean not null default true,
  recycled_parts boolean not null default true,
  mobile_fitting boolean not null default false,
  status text not null default 'pending' check (status in ('pending','active','suspended','rejected')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create index if not exists garage_partners_public_idx
  on public.garage_partners(status,(verified_at is not null) desc,business_name,id);
create index if not exists garage_partners_location_idx
  on public.garage_partners(latitude,longitude)
  where status='active' and latitude is not null and longitude is not null;

alter table public.garage_partners enable row level security;

drop policy if exists "garage partners public or own read" on public.garage_partners;
create policy "garage partners public or own read" on public.garage_partners
for select to anon,authenticated
using (
  status='active'
  or owner_id=(select auth.uid())
  or private.is_admin()
);

drop policy if exists "garage partners create own" on public.garage_partners;
create policy "garage partners create own" on public.garage_partners
for insert to authenticated
with check (
  owner_id=(select auth.uid())
  and status='pending'
  and verified_at is null
);

drop policy if exists "garage partners update own" on public.garage_partners;
create policy "garage partners update own" on public.garage_partners
for update to authenticated
using (owner_id=(select auth.uid()) or private.is_admin())
with check (owner_id=(select auth.uid()) or private.is_admin());

create or replace function private.protect_garage_partner_review()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  identity_changed boolean;
begin
  if private.is_admin() then
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Garage ownership cannot be changed.';
  end if;
  if new.status is distinct from old.status then
    raise exception 'Only administrators can change garage partner review status.';
  end if;
  if new.verified_at is distinct from old.verified_at then
    raise exception 'Only administrators can change garage verification.';
  end if;

  identity_changed:=
    new.business_name is distinct from old.business_name
    or new.location is distinct from old.location
    or new.postcode is distinct from old.postcode;

  if identity_changed and old.status='active' then
    new.status:='pending';
    new.verified_at:=null;
  end if;

  return new;
end;
$$;

drop trigger if exists garage_partners_protect_review on public.garage_partners;
create trigger garage_partners_protect_review
before update on public.garage_partners
for each row execute function private.protect_garage_partner_review();

drop trigger if exists garage_partners_touch on public.garage_partners;
create trigger garage_partners_touch
before update on public.garage_partners
for each row execute function private.touch_updated_at();

create table if not exists public.fitting_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete restrict,
  garage_partner_id uuid not null references public.garage_partners(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete set null,
  vehicle_variant_id uuid not null references public.vehicle_catalogue_variants(id) on delete restrict,
  vehicle_year smallint not null check (vehicle_year between 1900 and 2100),
  vehicle_fuel text,
  vehicle_engine_size integer,
  vehicle_registration text,
  buyer_notes text,
  status text not null default 'requested' check (status in ('requested','quoted','accepted','declined','cancelled','completed')),
  quote_pence integer check (quote_pence is null or quote_pence between 0 and 2000000),
  quote_note text,
  quoted_at timestamptz,
  buyer_responded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fitting_requests_buyer_created_idx
  on public.fitting_requests(buyer_id,created_at desc,id);
create index if not exists fitting_requests_garage_status_created_idx
  on public.fitting_requests(garage_partner_id,status,created_at desc,id);
create index if not exists fitting_requests_part_idx
  on public.fitting_requests(part_id,created_at desc);
create unique index if not exists fitting_requests_open_unique
  on public.fitting_requests(buyer_id,part_id,garage_partner_id,vehicle_variant_id,vehicle_year)
  where status in ('requested','quoted','accepted');

alter table public.fitting_requests enable row level security;

drop policy if exists "fitting requests participant read" on public.fitting_requests;
create policy "fitting requests participant read" on public.fitting_requests
for select to authenticated
using (
  buyer_id=(select auth.uid())
  or exists(
    select 1 from public.garage_partners g
    where g.id=garage_partner_id and g.owner_id=(select auth.uid())
  )
  or private.is_admin()
);

create or replace function public.request_part_fitting_quote(
  p_part_id uuid,
  p_garage_partner_id uuid,
  p_vehicle_variant_id uuid,
  p_vehicle_year smallint,
  p_vehicle_fuel text default null,
  p_vehicle_engine integer default null,
  p_vehicle_registration text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
  part_row record;
  garage_row record;
  new_id uuid;
  normalized_registration text;
begin
  if actor is null then raise exception 'Authentication required.'; end if;

  select p.id,p.seller_id,s.owner_id as seller_owner
  into part_row
  from public.parts p
  join public.sellers s on s.id=p.seller_id
  where p.id=p_part_id and p.status='active'::public.listing_status;

  if part_row.id is null then raise exception 'Listing is not available for fitting requests.'; end if;
  if part_row.seller_owner=actor then raise exception 'You cannot request fitting for your own listing.'; end if;

  select g.id,g.owner_id,g.customer_supplied_parts,g.recycled_parts
  into garage_row
  from public.garage_partners g
  where g.id=p_garage_partner_id and g.status='active';

  if garage_row.id is null then raise exception 'Garage partner is not available.'; end if;
  if garage_row.owner_id=actor then raise exception 'You cannot request a quote from your own garage profile.'; end if;
  if not garage_row.customer_supplied_parts or not garage_row.recycled_parts then
    raise exception 'This garage is not accepting customer-supplied recycled parts.';
  end if;

  if not exists(
    select 1 from public.vehicle_catalogue_years y
    where y.variant_id=p_vehicle_variant_id and y.year_first_used=p_vehicle_year
  ) then
    raise exception 'The selected vehicle/year is not in the vehicle catalogue.';
  end if;

  if p_vehicle_fuel is not null or p_vehicle_engine is not null then
    if not exists(
      select 1 from public.vehicle_catalogue_engines e
      where e.variant_id=p_vehicle_variant_id
        and (p_vehicle_fuel is null or upper(e.fuel_type)=upper(p_vehicle_fuel))
        and (p_vehicle_engine is null or e.engine_size_simple=p_vehicle_engine)
    ) then
      raise exception 'The selected engine/fuel combination is not in the vehicle catalogue.';
    end if;
  end if;

  normalized_registration:=nullif(regexp_replace(upper(coalesce(p_vehicle_registration,'')),'[^A-Z0-9]','','g'),'');
  if normalized_registration is not null and normalized_registration !~ '^[A-Z0-9]{2,8}$' then
    raise exception 'The vehicle registration is not valid.';
  end if;

  if (select count(*) from public.fitting_requests r where r.buyer_id=actor and r.status in ('requested','quoted','accepted'))>=20 then
    raise exception 'Too many active fitting requests.';
  end if;

  if exists(
    select 1 from public.fitting_requests r
    where r.buyer_id=actor
      and r.part_id=p_part_id
      and r.garage_partner_id=p_garage_partner_id
      and r.vehicle_variant_id=p_vehicle_variant_id
      and r.vehicle_year=p_vehicle_year
      and r.status in ('requested','quoted','accepted')
  ) then
    raise exception 'A fitting request is already open for this part, garage and vehicle.';
  end if;

  insert into public.fitting_requests(
    buyer_id,part_id,garage_partner_id,vehicle_variant_id,vehicle_year,
    vehicle_fuel,vehicle_engine_size,vehicle_registration,buyer_notes
  )
  values(
    actor,p_part_id,p_garage_partner_id,p_vehicle_variant_id,p_vehicle_year,
    nullif(left(btrim(coalesce(p_vehicle_fuel,'')),80),''),
    p_vehicle_engine,
    normalized_registration,
    nullif(left(btrim(coalesce(p_notes,'')),1000),'')
  )
  returning id into new_id;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(
    garage_row.owner_id,
    'fitting_request',
    'New fitting quote request',
    'A buyer requested a labour quote for a SecondPart part.',
    '/garage-partner/requests',
    'fitting-request:'||new_id::text||':garage'
  )
  on conflict do nothing;

  return new_id;
end;
$$;

create or replace function public.garage_respond_fitting_request(
  p_request_id uuid,
  p_action text,
  p_quote_pence integer default null,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
  request_row record;
begin
  if actor is null then raise exception 'Authentication required.'; end if;

  select r.id,r.status,r.buyer_id,g.owner_id
  into request_row
  from public.fitting_requests r
  join public.garage_partners g on g.id=r.garage_partner_id
  where r.id=p_request_id
  for update of r;

  if request_row.id is null or (request_row.owner_id<>actor and not private.is_admin()) then
    raise exception 'Fitting request not found.';
  end if;

  if p_action='quote' then
    if request_row.status not in ('requested','quoted') then raise exception 'This fitting request cannot be quoted.'; end if;
    if p_quote_pence is null or p_quote_pence<0 or p_quote_pence>2000000 then raise exception 'Enter a valid labour quote.'; end if;

    update public.fitting_requests
    set status='quoted',
        quote_pence=p_quote_pence,
        quote_note=nullif(left(btrim(coalesce(p_note,'')),1000),''),
        quoted_at=now()
    where id=p_request_id;

    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      request_row.buyer_id,'fitting_quote','Garage sent a fitting quote',
      'A garage responded to your SecondPart fitting request.',
      '/account/fitting','fitting-quote:'||p_request_id::text||':buyer'
    ) on conflict do nothing;
    return true;
  elsif p_action='decline' then
    if request_row.status not in ('requested','quoted') then raise exception 'This fitting request cannot be declined.'; end if;
    update public.fitting_requests
    set status='declined',
        quote_note=nullif(left(btrim(coalesce(p_note,'')),1000),'')
    where id=p_request_id;

    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      request_row.buyer_id,'fitting_quote','Garage declined the fitting request',
      'Try another SecondPart garage partner for this part.',
      '/account/fitting','fitting-declined:'||p_request_id::text||':buyer'
    ) on conflict do nothing;
    return true;
  elsif p_action='complete' then
    if request_row.status<>'accepted' then raise exception 'Only an accepted fitting request can be completed.'; end if;
    update public.fitting_requests set status='completed',completed_at=now() where id=p_request_id;
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      request_row.buyer_id,'fitting_update','Garage marked fitting complete',
      'Your fitting request was marked completed.',
      '/account/fitting','fitting-complete:'||p_request_id::text||':buyer'
    ) on conflict do nothing;
    return true;
  end if;

  raise exception 'Invalid fitting request action.';
end;
$$;

create or replace function public.buyer_respond_fitting_quote(
  p_request_id uuid,
  p_action text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
  request_row record;
begin
  if actor is null then raise exception 'Authentication required.'; end if;

  select r.id,r.status,r.garage_partner_id,g.owner_id
  into request_row
  from public.fitting_requests r
  join public.garage_partners g on g.id=r.garage_partner_id
  where r.id=p_request_id and r.buyer_id=actor
  for update of r;

  if request_row.id is null then raise exception 'Fitting request not found.'; end if;

  if p_action='accept' then
    if request_row.status<>'quoted' then raise exception 'This fitting quote is not ready to accept.'; end if;
    update public.fitting_requests
    set status='accepted',buyer_responded_at=now()
    where id=p_request_id;

    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      request_row.owner_id,'fitting_update','Buyer accepted your fitting quote',
      'The buyer accepted the labour quote. Arrange the fitting through the SecondPart request.',
      '/garage-partner/requests','fitting-accepted:'||p_request_id::text||':garage'
    ) on conflict do nothing;
    return true;
  elsif p_action='cancel' then
    if request_row.status not in ('requested','quoted','accepted') then raise exception 'This fitting request cannot be cancelled.'; end if;
    update public.fitting_requests
    set status='cancelled',buyer_responded_at=now()
    where id=p_request_id;

    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      request_row.owner_id,'fitting_update','Buyer cancelled a fitting request',
      'The fitting request is no longer active.',
      '/garage-partner/requests','fitting-cancelled:'||p_request_id::text||':garage'
    ) on conflict do nothing;
    return true;
  end if;

  raise exception 'Invalid fitting quote action.';
end;
$$;

revoke all on function public.request_part_fitting_quote(uuid,uuid,uuid,smallint,text,integer,text,text) from public;
revoke execute on function public.request_part_fitting_quote(uuid,uuid,uuid,smallint,text,integer,text,text) from anon;
grant execute on function public.request_part_fitting_quote(uuid,uuid,uuid,smallint,text,integer,text,text) to authenticated;

revoke all on function public.garage_respond_fitting_request(uuid,text,integer,text) from public;
revoke execute on function public.garage_respond_fitting_request(uuid,text,integer,text) from anon;
grant execute on function public.garage_respond_fitting_request(uuid,text,integer,text) to authenticated;

revoke all on function public.buyer_respond_fitting_quote(uuid,text) from public;
revoke execute on function public.buyer_respond_fitting_quote(uuid,text) from anon;
grant execute on function public.buyer_respond_fitting_quote(uuid,text) to authenticated;
