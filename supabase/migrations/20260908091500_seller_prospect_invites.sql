alter table public.founding_seller_applications
  add column if not exists prospect_id uuid references public.seller_prospects(id) on delete set null;

create unique index if not exists founding_seller_applications_prospect_unique
  on public.founding_seller_applications(prospect_id)
  where prospect_id is not null;

create table if not exists public.seller_prospect_invites (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null unique references public.seller_prospects(id) on delete cascade,
  token text not null unique check (char_length(token) between 20 and 200),
  created_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_prospect_invites_expires_idx
  on public.seller_prospect_invites(expires_at,used_at);

alter table public.seller_prospect_invites enable row level security;

drop policy if exists "seller prospect invites admin read" on public.seller_prospect_invites;
create policy "seller prospect invites admin read" on public.seller_prospect_invites
for select to authenticated using (private.is_admin());

drop policy if exists "seller prospect invites admin insert" on public.seller_prospect_invites;
create policy "seller prospect invites admin insert" on public.seller_prospect_invites
for insert to authenticated with check (private.is_admin() and created_by=(select auth.uid()));

drop policy if exists "seller prospect invites admin update" on public.seller_prospect_invites;
create policy "seller prospect invites admin update" on public.seller_prospect_invites
for update to authenticated using (private.is_admin()) with check (private.is_admin());

drop trigger if exists seller_prospect_invites_touch on public.seller_prospect_invites;
create trigger seller_prospect_invites_touch
before update on public.seller_prospect_invites
for each row execute function private.touch_updated_at();

revoke all on table public.seller_prospect_invites from anon,authenticated;
grant select,insert,update on table public.seller_prospect_invites to authenticated;
grant all on table public.seller_prospect_invites to service_role;
