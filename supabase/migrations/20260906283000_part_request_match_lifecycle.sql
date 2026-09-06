-- Seller-side lifecycle for targeted Find My Part matches.

alter table public.seller_part_request_matches
  add column if not exists status text not null default 'open'
    check (status in ('open','dismissed','responded')),
  add column if not exists responded_part_id uuid references public.parts(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists seller_part_request_matches_queue_idx
  on public.seller_part_request_matches(seller_id,status,match_score desc,created_at desc);

create or replace function public.dismiss_seller_part_request_match(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  current_seller uuid;
  changed integer;
begin
  select s.id into current_seller
  from public.sellers s
  where s.owner_id=auth.uid()
  limit 1;

  if current_seller is null then
    raise exception 'Seller access required.';
  end if;

  update public.seller_part_request_matches m
  set status='dismissed',updated_at=now()
  where m.request_id=p_request_id
    and m.seller_id=current_seller
    and m.status='open';

  get diagnostics changed=row_count;
  return changed>0;
end;
$$;

revoke all on function public.dismiss_seller_part_request_match(uuid) from public;
grant execute on function public.dismiss_seller_part_request_match(uuid) to authenticated;

create or replace function private.mark_part_request_match_responded()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.source_request_id is null then
    return new;
  end if;

  update public.seller_part_request_matches m
  set
    status='responded',
    responded_part_id=new.id,
    updated_at=now()
  where m.request_id=new.source_request_id
    and m.seller_id=new.seller_id
    and m.status='open';

  return new;
end;
$$;

drop trigger if exists mark_part_request_match_responded_trigger on public.parts;
create trigger mark_part_request_match_responded_trigger
after insert or update of source_request_id
on public.parts
for each row execute function private.mark_part_request_match_responded();

-- Dismissed/responded leads must not remain in the seller's active queue.
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
        and m.status='open'
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
  join public.seller_part_request_matches m
    on m.seller_id=cs.id
   and m.status='open'
  join public.seller_part_request_leads l
    on l.request_id=m.request_id
   and l.status='open'
  left join public.categories c on c.id=l.category_id
  left join public.vehicle_catalogue_variants v on v.id=l.catalogue_variant_id
  order by m.match_score desc,l.created_at desc,l.request_id
  limit greatest(1,least(coalesce(p_limit,24),60))+1
  offset greatest(0,coalesce(p_offset,0));
$$;

revoke all on function public.seller_ranked_part_request_leads(integer,integer) from public;
grant execute on function public.seller_ranked_part_request_leads(integer,integer) to authenticated;

-- Buyer count reflects sellers still handling the request or who already responded.
create or replace function public.buyer_part_request_match_counts()
returns table(
  request_id uuid,
  matching_seller_count integer,
  verified_seller_count integer
)
language sql
stable
security definer
set search_path=''
as $$
  select
    r.id as request_id,
    count(distinct m.seller_id) filter(where m.status<>'dismissed')::integer,
    count(distinct m.seller_id) filter(where m.status<>'dismissed' and s.verified_at is not null)::integer
  from public.part_requests r
  left join public.seller_part_request_matches m on m.request_id=r.id
  left join public.sellers s on s.id=m.seller_id
  where r.profile_id=auth.uid()
    and r.status='open'
  group by r.id;
$$;

revoke all on function public.buyer_part_request_match_counts() from public;
grant execute on function public.buyer_part_request_match_counts() to authenticated;
