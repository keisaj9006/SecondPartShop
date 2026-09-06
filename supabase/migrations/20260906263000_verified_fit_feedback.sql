-- Verified fit feedback and checkout vehicle snapshots.
-- A fit claim is tied to a completed SecondPart transaction and the vehicle
-- context captured at checkout. Raw buyer feedback remains private; only
-- aggregate evidence is exposed publicly.

alter table public.order_items
  add column if not exists buyer_vehicle_variant_id uuid references public.vehicle_catalogue_variants(id) on delete set null,
  add column if not exists buyer_vehicle_year smallint,
  add column if not exists buyer_vehicle_fuel text,
  add column if not exists buyer_vehicle_engine_size integer,
  add column if not exists buyer_vehicle_registration text;

alter table public.order_items
  drop constraint if exists order_items_buyer_vehicle_year_check;
alter table public.order_items
  add constraint order_items_buyer_vehicle_year_check
  check (buyer_vehicle_year is null or buyer_vehicle_year between 1900 and 2100);

alter table public.order_items
  drop constraint if exists order_items_buyer_vehicle_engine_check;
alter table public.order_items
  add constraint order_items_buyer_vehicle_engine_check
  check (buyer_vehicle_engine_size is null or buyer_vehicle_engine_size between 100 and 10000);

alter table public.order_items
  drop constraint if exists order_items_buyer_vehicle_registration_check;
alter table public.order_items
  add constraint order_items_buyer_vehicle_registration_check
  check (
    buyer_vehicle_registration is null
    or buyer_vehicle_registration ~ '^[A-Z0-9]{2,8}$'
  );

create index if not exists order_items_buyer_vehicle_idx
  on public.order_items(buyer_vehicle_variant_id,buyer_vehicle_year,buyer_vehicle_fuel,buyer_vehicle_engine_size)
  where buyer_vehicle_variant_id is not null;

create table if not exists public.verified_fit_feedback (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete cascade,
  variant_id uuid not null references public.vehicle_catalogue_variants(id) on delete restrict,
  year smallint not null check (year between 1900 and 2100),
  fuel_type text,
  engine_size_simple integer check (engine_size_simple is null or engine_size_simple between 100 and 10000),
  result text not null check (result in ('exact_fit','fit_with_modification','did_not_fit','not_installed')),
  notes text check (notes is null or char_length(notes)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verified_fit_feedback_part_vehicle_idx
  on public.verified_fit_feedback(part_id,variant_id,year,fuel_type,engine_size_simple);
create index if not exists verified_fit_feedback_buyer_idx
  on public.verified_fit_feedback(buyer_id,updated_at desc);

alter table public.verified_fit_feedback enable row level security;

drop policy if exists "verified fit feedback buyer read own" on public.verified_fit_feedback;
create policy "verified fit feedback buyer read own"
  on public.verified_fit_feedback for select
  to authenticated
  using (buyer_id=(select auth.uid()) or private.is_admin());

revoke all on public.verified_fit_feedback from anon,authenticated;
grant select on public.verified_fit_feedback to authenticated;

create or replace function public.prepare_checkout_order_v2(
  p_part_id uuid,
  p_quantity integer default 1,
  p_delivery_method text default 'shipping',
  p_vehicle_variant_id uuid default null,
  p_vehicle_year smallint default null,
  p_vehicle_fuel text default null,
  p_vehicle_engine integer default null,
  p_vehicle_registration text default null
)
returns table(
  order_id uuid,
  order_item_id uuid,
  part_title text,
  seller_name text,
  quantity integer,
  unit_price_pence integer,
  shipping_pence integer,
  platform_fee_pence integer,
  seller_net_pence integer,
  total_pence integer,
  checkout_expires_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  reservation record;
  normalized_registration text;
begin
  if p_vehicle_variant_id is null then
    if p_vehicle_year is not null or p_vehicle_fuel is not null or p_vehicle_engine is not null or nullif(btrim(coalesce(p_vehicle_registration,'')),'') is not null then
      raise exception 'Vehicle variant is required when checkout vehicle details are supplied.';
    end if;
  else
    if p_vehicle_year is null then
      raise exception 'Vehicle year is required for a checkout vehicle snapshot.';
    end if;

    if not exists(
      select 1
      from public.vehicle_catalogue_years y
      where y.variant_id=p_vehicle_variant_id
        and y.year_first_used=p_vehicle_year
    ) then
      raise exception 'The selected vehicle/year is not in the vehicle catalogue.';
    end if;

    if p_vehicle_fuel is not null or p_vehicle_engine is not null then
      if not exists(
        select 1
        from public.vehicle_catalogue_engines e
        where e.variant_id=p_vehicle_variant_id
          and (p_vehicle_fuel is null or upper(e.fuel_type)=upper(p_vehicle_fuel))
          and (p_vehicle_engine is null or e.engine_size_simple=p_vehicle_engine)
      ) then
        raise exception 'The selected engine/fuel combination is not in the vehicle catalogue.';
      end if;
    end if;
  end if;

  normalized_registration:=nullif(regexp_replace(upper(coalesce(p_vehicle_registration,'')),'[^A-Z0-9]','','g'),'');
  if normalized_registration is not null and normalized_registration !~ '^[A-Z0-9]{2,8}$' then
    raise exception 'The vehicle registration is not valid.';
  end if;

  select * into reservation
  from public.prepare_checkout_order(p_part_id,p_quantity,p_delivery_method);

  update public.order_items
  set
    buyer_vehicle_variant_id=p_vehicle_variant_id,
    buyer_vehicle_year=p_vehicle_year,
    buyer_vehicle_fuel=nullif(btrim(coalesce(p_vehicle_fuel,'')),''),
    buyer_vehicle_engine_size=p_vehicle_engine,
    buyer_vehicle_registration=normalized_registration
  where id=reservation.order_item_id;

  return query
  select
    reservation.order_id,
    reservation.order_item_id,
    reservation.part_title,
    reservation.seller_name,
    reservation.quantity,
    reservation.unit_price_pence,
    reservation.shipping_pence,
    reservation.platform_fee_pence,
    reservation.seller_net_pence,
    reservation.total_pence,
    reservation.checkout_expires_at;
end;
$$;

revoke all on function public.prepare_checkout_order_v2(uuid,integer,text,uuid,smallint,text,integer,text) from public;
grant execute on function public.prepare_checkout_order_v2(uuid,integer,text,uuid,smallint,text,integer,text) to authenticated;

create or replace function public.get_verified_fit_opportunities()
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
  select
    oi.id,
    oi.part_id,
    p.title,
    p.slug,
    oi.buyer_vehicle_variant_id,
    v.make,
    v.model_family,
    v.variant,
    oi.buyer_vehicle_year,
    oi.buyer_vehicle_fuel,
    oi.buyer_vehicle_engine_size,
    f.result,
    f.notes,
    oi.funds_released_at
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.parts p on p.id=oi.part_id
  join public.vehicle_catalogue_variants v on v.id=oi.buyer_vehicle_variant_id
  left join public.verified_fit_feedback f on f.order_item_id=oi.id
  where o.buyer_id=auth.uid()
    and o.payment_status='paid'
    and oi.fulfilment_status='completed'
    and oi.payout_status='released'
    and oi.funds_released_at is not null
    and oi.refunded_at is null
    and oi.buyer_vehicle_year is not null
    and not exists(
      select 1
      from public.transaction_cases c
      where c.order_item_id=oi.id
        and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
    )
  order by oi.funds_released_at desc;
$$;

revoke all on function public.get_verified_fit_opportunities() from public;
grant execute on function public.get_verified_fit_opportunities() to authenticated;

create or replace function public.submit_verified_fit_feedback(
  p_order_item_id uuid,
  p_result text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  current_profile uuid:=auth.uid();
  snapshot record;
  feedback_id uuid;
begin
  if current_profile is null then raise exception 'Authentication required.'; end if;
  if p_result not in ('exact_fit','fit_with_modification','did_not_fit','not_installed') then
    raise exception 'Invalid fit feedback result.';
  end if;

  select
    o.buyer_id,
    o.payment_status,
    oi.part_id,
    oi.fulfilment_status,
    oi.payout_status,
    oi.funds_released_at,
    oi.refunded_at,
    oi.buyer_vehicle_variant_id,
    oi.buyer_vehicle_year,
    oi.buyer_vehicle_fuel,
    oi.buyer_vehicle_engine_size
  into snapshot
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  where oi.id=p_order_item_id;

  if snapshot.buyer_id is null then raise exception 'Transaction not found.'; end if;
  if snapshot.buyer_id<>current_profile then raise exception 'Only the buyer can verify fitment.'; end if;
  if snapshot.payment_status<>'paid'
     or snapshot.fulfilment_status<>'completed'
     or snapshot.payout_status<>'released'
     or snapshot.funds_released_at is null
     or snapshot.refunded_at is not null then
    raise exception 'Fit feedback unlocks only after a successfully completed, non-refunded transaction.';
  end if;
  if snapshot.buyer_vehicle_variant_id is null or snapshot.buyer_vehicle_year is null then
    raise exception 'This transaction does not have a verified checkout vehicle snapshot.';
  end if;
  if exists(
    select 1 from public.transaction_cases c
    where c.order_item_id=p_order_item_id
      and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
  ) then
    raise exception 'Fit feedback is paused while a transaction case is active.';
  end if;

  insert into public.verified_fit_feedback(
    order_item_id,buyer_id,part_id,variant_id,year,fuel_type,engine_size_simple,result,notes
  )
  values(
    p_order_item_id,current_profile,snapshot.part_id,snapshot.buyer_vehicle_variant_id,
    snapshot.buyer_vehicle_year,snapshot.buyer_vehicle_fuel,snapshot.buyer_vehicle_engine_size,
    p_result,nullif(left(btrim(coalesce(p_notes,'')),1000),'')
  )
  on conflict(order_item_id) do update
  set
    result=excluded.result,
    notes=excluded.notes,
    updated_at=now()
  returning id into feedback_id;

  return feedback_id;
end;
$$;

revoke all on function public.submit_verified_fit_feedback(uuid,text,text) from public;
grant execute on function public.submit_verified_fit_feedback(uuid,text,text) to authenticated;

create or replace function public.get_part_verified_fit_summary(
  p_part_id uuid,
  p_variant_id uuid,
  p_year smallint,
  p_fuel text default null,
  p_engine integer default null
)
returns table(
  exact_fit_count integer,
  modified_fit_count integer,
  did_not_fit_count integer
)
language sql
stable
security definer
set search_path=''
as $$
  select
    count(distinct f.buyer_id) filter(where f.result='exact_fit')::integer,
    count(distinct f.buyer_id) filter(where f.result='fit_with_modification')::integer,
    count(distinct f.buyer_id) filter(where f.result='did_not_fit')::integer
  from public.verified_fit_feedback f
  where f.part_id=p_part_id
    and f.variant_id=p_variant_id
    and f.year=p_year
    and (p_fuel is null or (f.fuel_type is not null and upper(f.fuel_type)=upper(p_fuel)))
    and (p_engine is null or f.engine_size_simple=p_engine);
$$;

revoke all on function public.get_part_verified_fit_summary(uuid,uuid,smallint,text,integer) from public;
grant execute on function public.get_part_verified_fit_summary(uuid,uuid,smallint,text,integer) to anon,authenticated;

create or replace function public.marketplace_catalogue_compatibility(
  p_variant_id uuid,
  p_year smallint,
  p_fuel text default null,
  p_engine integer default null,
  p_part_id uuid default null
)
returns table(part_id uuid, confidence text)
language sql
stable
set search_path=''
as $$
  with selected as (
    select v.provider,v.make,v.model_family,v.body_type
    from public.vehicle_catalogue_variants v
    where v.id=p_variant_id
  ),
  exact_matches as (
    select f.part_id,'confirmed'::text as confidence,4 as rank
    from public.part_catalogue_fitments f
    where f.variant_id=p_variant_id
      and (p_part_id is null or f.part_id=p_part_id)
      and (f.year_from is null or p_year>=f.year_from)
      and (f.year_to is null or p_year<=f.year_to)
      and (f.fuel_type is null or (p_fuel is not null and upper(f.fuel_type)=upper(p_fuel)))
      and (f.engine_size_simple is null or (p_engine is not null and f.engine_size_simple=p_engine))
  ),
  buyer_verified_matches as (
    select
      f.part_id,
      'buyer_verified'::text as confidence,
      3 as rank
    from public.verified_fit_feedback f
    where f.variant_id=p_variant_id
      and f.year=p_year
      and (p_part_id is null or f.part_id=p_part_id)
      and (p_fuel is null or (f.fuel_type is not null and upper(f.fuel_type)=upper(p_fuel)))
      and (p_engine is null or f.engine_size_simple=p_engine)
    group by f.part_id
    having
      count(distinct f.buyer_id) filter(where f.result='exact_fit')>=2
      and count(distinct f.buyer_id) filter(where f.result='exact_fit')
          >= greatest(2,3*count(distinct f.buyer_id) filter(where f.result='did_not_fit'))
  ),
  family_matches as (
    select f.part_id,'family_match'::text as confidence,2 as rank
    from selected s
    join public.vehicle_catalogue_variants sibling
      on sibling.provider=s.provider
     and sibling.body_type is not distinct from s.body_type
     and sibling.make=s.make
     and sibling.model_family=s.model_family
     and sibling.id<>p_variant_id
    join public.part_catalogue_fitments f on f.variant_id=sibling.id
    where (p_part_id is null or f.part_id=p_part_id)
      and (f.year_from is null or p_year>=f.year_from)
      and (f.year_to is null or p_year<=f.year_to)
      and (f.fuel_type is null or (p_fuel is not null and upper(f.fuel_type)=upper(p_fuel)))
      and (f.engine_size_simple is null or (p_engine is not null and f.engine_size_simple=p_engine))
  ),
  donor_matches as (
    select p.id as part_id,'family_match'::text as confidence,1 as rank
    from selected s
    join public.parts p
      on p.donor_vehicle_id is not null
     and (p_part_id is null or p.id=p_part_id)
    join public.donor_vehicles d on d.id=p.donor_vehicle_id
    where regexp_replace(upper(d.make),'[^A-Z0-9]','','g')
          =regexp_replace(upper(s.make),'[^A-Z0-9]','','g')
      and regexp_replace(upper(d.model),'[^A-Z0-9]','','g')
          =regexp_replace(upper(s.model_family),'[^A-Z0-9]','','g')
      and d.year=p_year
      and (
        d.fuel_type is null
        or p_fuel is null
        or regexp_replace(upper(d.fuel_type),'[^A-Z0-9]','','g')
           =regexp_replace(upper(p_fuel),'[^A-Z0-9]','','g')
      )
      and (d.engine_size_simple is null or p_engine is null or d.engine_size_simple=p_engine)
  ),
  combined as (
    select * from exact_matches
    union all
    select * from buyer_verified_matches
    union all
    select * from family_matches
    union all
    select * from donor_matches
  )
  select distinct on (combined.part_id) combined.part_id,combined.confidence
  from combined
  order by combined.part_id,combined.rank desc;
$$;

revoke all on function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid) from public;
grant execute on function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid) to anon,authenticated;
