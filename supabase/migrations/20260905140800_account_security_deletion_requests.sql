create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','cancelled','completed')),
  reason text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists account_deletion_requests_open_unique
  on public.account_deletion_requests(profile_id)
  where status='requested';

alter table public.account_deletion_requests enable row level security;

drop policy if exists "account deletion own read" on public.account_deletion_requests;
create policy "account deletion own read"
  on public.account_deletion_requests for select
  to authenticated
  using ((select auth.uid())=profile_id);

drop policy if exists "account deletion own insert" on public.account_deletion_requests;
create policy "account deletion own insert"
  on public.account_deletion_requests for insert
  to authenticated
  with check ((select auth.uid())=profile_id);

drop policy if exists "account deletion own update" on public.account_deletion_requests;
create policy "account deletion own update"
  on public.account_deletion_requests for update
  to authenticated
  using ((select auth.uid())=profile_id)
  with check ((select auth.uid())=profile_id);

grant select,insert,update on public.account_deletion_requests to authenticated;
