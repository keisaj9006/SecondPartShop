-- Route Find My Part demand to a small, relevant seller set instead of every seller.

create table if not exists public.seller_part_request_matches (
  request_id uuid not null references public.part_requests(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete cascade,
  match_score integer not null check (match_score >= 0),
  match_reasons text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key(request_id,seller_id)
);

create index if not exists seller_part_request_matches_seller_idx
  on public.seller_part_request_matches(seller_id,match_score desc,created_at desc);

create index if not exists parts_seller_category_status_idx
  on public.parts(seller_id,category_id,status);

create index if not exists parts_seller_oem_compact_idx
  on public.parts(
    seller_id,
    (regexp_replace(lower(coalesce(oem_number,'')),'[^a-z0-9]','','g'))
  )
  where status in ('active'::public.listing_status,'draft'::public.listing_status)
    and oem_number is not null;

create index if not exists donor_vehicles_seller_year_idx
  on public.donor_vehicles(seller_id,year);

alter table public.seller_part_request_matches enable row level security;

drop policy if exists "seller request matches read own" on public.seller_part_request_matches;
create policy "seller request matches read own"
  on public.seller_part_request_matches for select
  to authenticated
  using (
    exists(
      select 1 from public.sellers s
      where s.id=seller_id and s.owner_id=(select auth.uid())
    )
    or private.is_admin()
  );

revoke all on public.seller_part_request_matches from anon,authenticated;
grant select on public.seller_part_request_matches to authenticated;

create or replace function private.refresh_seller_part_request_matches(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  request_status text;
begin
  delete from public.seller_part_request_matches
  where request_id=p_request_id;

  select r.status into request_status
  from public.part_requests r
  where r.id=p_request_id;

  if request_status is distinct from 'open' then
    return;
  end if;

  insert into public.seller_part_request_matches(
    request_id,seller_id,match_score,match_reasons
  )
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
      seller_id,
      (case when exact_oem then 120 else 0 end)
      +(case when exact_fitment then 90 else 0 end)
      +(case when donor_match then 70 else 0 end)
      +(case when category_match then 35 else 0 end)
      +(case when active_inventory>0 then 5 else 0 end)
      +(case when verified then 3 else 0 end) as score,
      active_inventory,
      verified,
      array_remove(array[
        case when exact_oem then 'OE/OEM match' end,
        case when exact_fitment then 'Exact vehicle fitment in inventory' end,
        case when donor_match then 'Matching donor vehicle' end,
        case when category_match then 'Relevant category inventory' end,
        case when not exact_oem and not exact_fitment and not donor_match and not category_match and active_inventory>0 then 'Active marketplace inventory' end
      ]::text[],null) as reasons
    from features
  )
  select
    p_request_id,
    seller_id,
    score,
    reasons
  from scored
  where score>0
  order by
    (score>=35) desc,
    score desc,
    verified desc,
    active_inventory desc,
    seller_id
  limit 12;
end;
$$;

create or replace function private.route_part_request_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.refresh_seller_part_request_matches(new.id);
  return new;
end;
$$;

drop trigger if exists route_part_request_matches_trigger on public.part_requests;
create trigger route_part_request_matches_trigger
after insert or update of status,category_id,catalogue_variant_id,year,fuel_type,engine_size_simple,oem_number
on public.part_requests
for each row execute function private.route_part_request_trigger();

drop policy if exists "seller request leads read" on public.seller_part_request_leads;
create policy "seller request leads read"
  on public.seller_part_request_leads for select
  to authenticated
  using (
    private.is_admin()
    or exists(
      select 1
      from public.seller_part_request_matches m
      join public.sellers s on s.id=m.seller_id
      where m.request_id=seller_part_request_leads.request_id
        and s.owner_id=(select auth.uid())
    )
  );

create or replace function public.seller_ranked_part_request_leads(
  p_limit integer default 24,
  p_offset integer default 0
)
returns table(
  request_id uuid,
  query_text text,
  oem_number text,
  notes text,
  created_at timestamptz,
  category_id uuid,
  category_name text,
  catalogue_variant_id uuid,
  vehicle_make text,
  vehicle_model text,
  vehicle_variant text,
  year smallint,
  fuel_type text,
  engine_size_simple integer,
  match_score integer,
  match_reasons text[]
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
  )
  select
    l.request_id,
    l.query_text,
    l.oem_number,
    l.notes,
    l.created_at,
    l.category_id,
    c.name,
    l.catalogue_variant_id,
    v.make,
    v.model_family,
    v.variant,
    l.year,
    l.fuel_type,
    l.engine_size_simple,
    m.match_score,
    m.match_reasons
  from current_seller cs
  join public.seller_part_request_matches m on m.seller_id=cs.id
  join public.seller_part_request_leads l on l.request_id=m.request_id and l.status='open'
  left join public.categories c on c.id=l.category_id
  left join public.vehicle_catalogue_variants v on v.id=l.catalogue_variant_id
  order by m.match_score desc,l.created_at desc,l.request_id
  limit greatest(1,least(coalesce(p_limit,24),60))+1
  offset greatest(0,coalesce(p_offset,0));
$$;

revoke all on function public.seller_ranked_part_request_leads(integer,integer) from public;
grant execute on function public.seller_ranked_part_request_leads(integer,integer) to authenticated;

-- Backfill routing for existing open demand.
select private.refresh_seller_part_request_matches(r.id)
from public.part_requests r
where r.status='open';
