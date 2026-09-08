create table if not exists public.seller_prospect_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.seller_prospects(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  activity_type text not null check (activity_type in ('research','email','call','reply','meeting','invite','note','status_change')),
  outcome text,
  note text check (note is null or char_length(note)<=2000),
  next_action_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists seller_prospect_activities_prospect_idx
  on public.seller_prospect_activities(prospect_id,created_at desc,id desc);
create index if not exists seller_prospect_activities_actor_idx
  on public.seller_prospect_activities(actor_profile_id,created_at desc,id desc);

alter table public.seller_prospect_activities enable row level security;

drop policy if exists "seller prospect activities admin read" on public.seller_prospect_activities;
create policy "seller prospect activities admin read" on public.seller_prospect_activities
for select to authenticated using (private.is_admin());

drop policy if exists "seller prospect activities admin insert" on public.seller_prospect_activities;
create policy "seller prospect activities admin insert" on public.seller_prospect_activities
for insert to authenticated with check (private.is_admin() and actor_profile_id=(select auth.uid()));

revoke all on table public.seller_prospect_activities from anon,authenticated;
grant select,insert on table public.seller_prospect_activities to authenticated;
grant all on table public.seller_prospect_activities to service_role;

create or replace function public.admin_next_best_seller_prospects(p_limit integer default 20)
returns table(
  id uuid,
  business_name text,
  business_kind text,
  location text,
  postcode text,
  public_email text,
  public_phone text,
  website_url text,
  estimated_inventory integer,
  priority text,
  status text,
  next_action_at timestamptz,
  last_contacted_at timestamptz,
  score integer,
  score_reasons text[]
)
language sql
stable
security definer
set search_path=''
as $$
  with eligible as (
    select p.*
    from public.seller_prospects p
    where private.is_admin()
      and p.status not in ('onboarded','not_interested','do_not_contact')
  ),
  scored as (
    select
      p.*,
      (
        case p.priority when 'A' then 40 when 'B' then 20 else 0 end
        + case p.business_kind when 'breaker' then 25 when 'atf' then 25 when 'ebay_seller' then 18 when 'parts_business' then 15 when 'garage' then 10 else 5 end
        + case
            when p.estimated_inventory>=5000 then 25
            when p.estimated_inventory>=1000 then 18
            when p.estimated_inventory>=250 then 10
            when p.estimated_inventory is not null then 4
            else 0
          end
        + case p.status
            when 'onboarding' then 35
            when 'qualified' then 32
            when 'replied' then 28
            when 'invited' then 24
            when 'contacted' then 16
            when 'ready' then 10
            else 0
          end
        + case
            when p.next_action_at is not null and p.next_action_at<=now() then 35
            when p.next_action_at is not null and p.next_action_at<=now()+interval '2 days' then 18
            when p.next_action_at is null and p.status in ('ready','research') then 8
            else 0
          end
        + case when p.public_email is not null then 8 else 0 end
        + case when p.public_phone is not null then 5 else 0 end
        + case when p.website_url is not null then 3 else 0 end
        + case when p.source_url is not null then 3 else 0 end
      )::integer as score,
      array_remove(array[
        case when p.priority='A' then 'Priority A' when p.priority='B' then 'Priority B' end,
        case when p.business_kind in ('breaker','atf') then 'Core breaker/ATF target' when p.business_kind='ebay_seller' then 'Existing online seller' end,
        case when p.estimated_inventory>=5000 then 'Large estimated inventory' when p.estimated_inventory>=1000 then 'Meaningful estimated inventory' end,
        case when p.status in ('replied','qualified','invited','onboarding') then 'Warm pipeline stage' end,
        case when p.next_action_at is not null and p.next_action_at<=now() then 'Follow-up due now' when p.next_action_at is not null and p.next_action_at<=now()+interval '2 days' then 'Follow-up due soon' end,
        case when p.public_email is not null then 'Public business email available' end,
        case when p.public_phone is not null then 'Public business phone available' end,
        case when p.source_url is not null then 'Source provenance captured' end
      ]::text[],null) as score_reasons
    from eligible p
  )
  select
    s.id,s.business_name,s.business_kind,s.location,s.postcode,s.public_email,s.public_phone,s.website_url,
    s.estimated_inventory,s.priority,s.status,s.next_action_at,s.last_contacted_at,s.score,s.score_reasons
  from scored s
  order by
    (s.next_action_at is not null and s.next_action_at<=now()) desc,
    s.score desc,
    s.next_action_at asc nulls last,
    s.created_at asc,
    s.id
  limit least(greatest(coalesce(p_limit,20),1),100);
$$;

revoke all on function public.admin_next_best_seller_prospects(integer) from public;
revoke execute on function public.admin_next_best_seller_prospects(integer) from anon;
grant execute on function public.admin_next_best_seller_prospects(integer) to authenticated;
grant execute on function public.admin_next_best_seller_prospects(integer) to service_role;
