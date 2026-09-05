create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  search_params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_searches_profile_idx
  on public.saved_searches(profile_id, created_at desc);

alter table public.saved_searches enable row level security;

drop policy if exists "saved searches own read" on public.saved_searches;
create policy "saved searches own read"
  on public.saved_searches for select
  to authenticated
  using ((select auth.uid())=profile_id);

drop policy if exists "saved searches own insert" on public.saved_searches;
create policy "saved searches own insert"
  on public.saved_searches for insert
  to authenticated
  with check ((select auth.uid())=profile_id);

drop policy if exists "saved searches own update" on public.saved_searches;
create policy "saved searches own update"
  on public.saved_searches for update
  to authenticated
  using ((select auth.uid())=profile_id)
  with check ((select auth.uid())=profile_id);

drop policy if exists "saved searches own delete" on public.saved_searches;
create policy "saved searches own delete"
  on public.saved_searches for delete
  to authenticated
  using ((select auth.uid())=profile_id);

grant select,insert,update,delete on public.saved_searches to authenticated;

create table if not exists public.recently_viewed_parts (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(profile_id,part_id)
);

create index if not exists recently_viewed_parts_profile_idx
  on public.recently_viewed_parts(profile_id, viewed_at desc);

alter table public.recently_viewed_parts enable row level security;

drop policy if exists "recently viewed own read" on public.recently_viewed_parts;
create policy "recently viewed own read"
  on public.recently_viewed_parts for select
  to authenticated
  using ((select auth.uid())=profile_id);

drop policy if exists "recently viewed own insert" on public.recently_viewed_parts;
create policy "recently viewed own insert"
  on public.recently_viewed_parts for insert
  to authenticated
  with check ((select auth.uid())=profile_id);

drop policy if exists "recently viewed own update" on public.recently_viewed_parts;
create policy "recently viewed own update"
  on public.recently_viewed_parts for update
  to authenticated
  using ((select auth.uid())=profile_id)
  with check ((select auth.uid())=profile_id);

drop policy if exists "recently viewed own delete" on public.recently_viewed_parts;
create policy "recently viewed own delete"
  on public.recently_viewed_parts for delete
  to authenticated
  using ((select auth.uid())=profile_id);

grant select,insert,update,delete on public.recently_viewed_parts to authenticated;
