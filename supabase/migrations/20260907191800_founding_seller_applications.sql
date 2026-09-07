create table if not exists public.founding_seller_applications (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 120),
  email text not null check (char_length(btrim(email)) between 5 and 320),
  phone text,
  business_name text not null check (char_length(btrim(business_name)) between 2 and 160),
  business_kind text not null check (business_kind in ('breaker','garage','atf','parts_business','other')),
  postcode text not null check (char_length(btrim(postcode)) between 2 and 20),
  website_url text,
  existing_channels text[] not null default '{}',
  estimated_active_parts integer check (estimated_active_parts is null or estimated_active_parts between 0 and 10000000),
  import_interest text not null default 'unsure' check (import_interest in ('ai_manual','csv','ebay','api','unsure')),
  notes text,
  source text not null default 'website' check (char_length(source) between 1 and 80),
  status text not null default 'new' check (status in ('new','contacted','qualified','invited','onboarding','activated','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists founding_seller_applications_email_unique
  on public.founding_seller_applications(lower(email));
create index if not exists founding_seller_applications_status_created_idx
  on public.founding_seller_applications(status,created_at desc,id);

alter table public.founding_seller_applications enable row level security;

drop policy if exists "founding seller applications admin read" on public.founding_seller_applications;
create policy "founding seller applications admin read" on public.founding_seller_applications
for select to authenticated using (private.is_admin());

drop policy if exists "founding seller applications admin update" on public.founding_seller_applications;
create policy "founding seller applications admin update" on public.founding_seller_applications
for update to authenticated using (private.is_admin()) with check (private.is_admin());

drop trigger if exists founding_seller_applications_touch on public.founding_seller_applications;
create trigger founding_seller_applications_touch
before update on public.founding_seller_applications
for each row execute function private.touch_updated_at();

revoke all on table public.founding_seller_applications from anon,authenticated;
grant select,update on table public.founding_seller_applications to authenticated;
grant all on table public.founding_seller_applications to service_role;
