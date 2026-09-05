create table if not exists public.seller_verification_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  message text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text
);

create unique index if not exists seller_verification_requests_pending_unique
  on public.seller_verification_requests(seller_id)
  where status='pending';

create index if not exists seller_verification_requests_status_idx
  on public.seller_verification_requests(status, requested_at desc);

alter table public.seller_verification_requests enable row level security;

drop policy if exists "seller verification own read" on public.seller_verification_requests;
create policy "seller verification own read"
  on public.seller_verification_requests for select
  to authenticated
  using (
    requester_id=(select auth.uid())
    or private.is_admin()
  );

drop policy if exists "seller verification own insert" on public.seller_verification_requests;
create policy "seller verification own insert"
  on public.seller_verification_requests for insert
  to authenticated
  with check (
    requester_id=(select auth.uid())
    and exists (
      select 1 from public.sellers s
      where s.id=seller_id and s.owner_id=(select auth.uid())
    )
  );

drop policy if exists "seller verification admin update" on public.seller_verification_requests;
create policy "seller verification admin update"
  on public.seller_verification_requests for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

grant select,insert,update on public.seller_verification_requests to authenticated;

create table if not exists public.marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  part_id uuid references public.parts(id) on delete cascade,
  seller_id uuid references public.sellers(id) on delete cascade,
  reason text not null check (reason in ('suspected_counterfeit','incorrect_fitment','misleading_description','unsafe_item','seller_conduct','other')),
  details text,
  status text not null default 'open' check (status in ('open','reviewed','dismissed','actioned')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  check (part_id is not null or seller_id is not null)
);

create index if not exists marketplace_reports_status_idx
  on public.marketplace_reports(status, created_at desc);
create index if not exists marketplace_reports_part_idx
  on public.marketplace_reports(part_id);
create index if not exists marketplace_reports_seller_idx
  on public.marketplace_reports(seller_id);

alter table public.marketplace_reports enable row level security;

drop policy if exists "marketplace reports own read" on public.marketplace_reports;
create policy "marketplace reports own read"
  on public.marketplace_reports for select
  to authenticated
  using (reporter_id=(select auth.uid()) or private.is_admin());

drop policy if exists "marketplace reports own insert" on public.marketplace_reports;
create policy "marketplace reports own insert"
  on public.marketplace_reports for insert
  to authenticated
  with check (reporter_id=(select auth.uid()));

drop policy if exists "marketplace reports admin update" on public.marketplace_reports;
create policy "marketplace reports admin update"
  on public.marketplace_reports for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

grant select,insert,update on public.marketplace_reports to authenticated;

create or replace function private.protect_seller_verification()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.verified_at is distinct from old.verified_at and not private.is_admin() then
    raise exception 'Only administrators can change seller verification status.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_seller_verification_trigger on public.sellers;
create trigger protect_seller_verification_trigger
before update on public.sellers
for each row execute function private.protect_seller_verification();
