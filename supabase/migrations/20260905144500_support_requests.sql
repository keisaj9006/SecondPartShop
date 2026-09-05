create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null check (topic in ('account','seller','listing','compatibility','safety','other')),
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_requests_profile_idx
  on public.support_requests(profile_id,created_at desc);
create index if not exists support_requests_status_idx
  on public.support_requests(status,created_at desc);

alter table public.support_requests enable row level security;

drop policy if exists "support requests own read" on public.support_requests;
create policy "support requests own read"
  on public.support_requests for select
  to authenticated
  using (profile_id=(select auth.uid()) or private.is_admin());

drop policy if exists "support requests own insert" on public.support_requests;
create policy "support requests own insert"
  on public.support_requests for insert
  to authenticated
  with check (profile_id=(select auth.uid()));

drop policy if exists "support requests admin update" on public.support_requests;
create policy "support requests admin update"
  on public.support_requests for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

grant select,insert,update on public.support_requests to authenticated;
