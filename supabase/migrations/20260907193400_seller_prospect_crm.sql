create table if not exists public.seller_prospects (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  business_name text not null check (char_length(btrim(business_name)) between 2 and 180),
  business_kind text not null check (business_kind in ('breaker','atf','garage','parts_business','ebay_seller','other')),
  website_url text,
  public_email text,
  public_phone text,
  location text,
  postcode text,
  source_type text not null default 'manual' check (source_type in ('vra','regulator','ebay','website','manual','other')),
  source_url text,
  estimated_inventory integer check (estimated_inventory is null or estimated_inventory between 0 and 10000000),
  priority text not null default 'B' check (priority in ('A','B','C')),
  status text not null default 'research' check (status in ('research','ready','contacted','replied','qualified','invited','onboarding','onboarded','not_interested','do_not_contact')),
  last_contacted_at timestamptz,
  next_action_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_prospects_pipeline_idx
  on public.seller_prospects(status,priority,created_at desc,id);
create index if not exists seller_prospects_kind_idx
  on public.seller_prospects(business_kind,status,priority);
create index if not exists seller_prospects_next_action_idx
  on public.seller_prospects(next_action_at,status)
  where next_action_at is not null and status not in ('onboarded','not_interested','do_not_contact');

alter table public.seller_prospects enable row level security;

drop policy if exists "seller prospects admin read" on public.seller_prospects;
create policy "seller prospects admin read" on public.seller_prospects
for select to authenticated using (private.is_admin());

drop policy if exists "seller prospects admin insert" on public.seller_prospects;
create policy "seller prospects admin insert" on public.seller_prospects
for insert to authenticated with check (private.is_admin());

drop policy if exists "seller prospects admin update" on public.seller_prospects;
create policy "seller prospects admin update" on public.seller_prospects
for update to authenticated using (private.is_admin()) with check (private.is_admin());

drop trigger if exists seller_prospects_touch on public.seller_prospects;
create trigger seller_prospects_touch
before update on public.seller_prospects
for each row execute function private.touch_updated_at();

revoke all on table public.seller_prospects from anon,authenticated;
grant select,insert,update on table public.seller_prospects to authenticated;
grant all on table public.seller_prospects to service_role;
