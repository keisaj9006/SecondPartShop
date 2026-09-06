-- Keep marketplace seller profiles public while isolating payment-provider state.

drop trigger if exists protect_seller_commerce_state_trigger on public.sellers;
drop function if exists private.protect_seller_commerce_state();

create table if not exists public.seller_payment_accounts (
  seller_id uuid primary key references public.sellers(id) on delete cascade,
  payment_provider text not null default 'stripe'
    check (payment_provider in ('stripe')),
  provider_account_id text unique,
  onboarding_status text not null default 'not_started'
    check (onboarding_status in ('not_started','pending','restricted','complete')),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.seller_payment_accounts(
  seller_id,
  payment_provider,
  provider_account_id,
  onboarding_status,
  charges_enabled,
  payouts_enabled
)
select
  id,
  coalesce(payment_provider,'stripe'),
  payment_provider_account_id,
  payment_onboarding_status,
  charges_enabled,
  payouts_enabled
from public.sellers
where payment_provider_account_id is not null
   or payment_onboarding_status <> 'not_started'
   or charges_enabled
   or payouts_enabled
on conflict (seller_id) do nothing;

alter table public.seller_payment_accounts enable row level security;

drop policy if exists "seller payment account owner read" on public.seller_payment_accounts;
create policy "seller payment account owner read"
  on public.seller_payment_accounts for select
  to authenticated
  using (
    exists (
      select 1
      from public.sellers s
      where s.id=seller_payment_accounts.seller_id
        and s.owner_id=(select auth.uid())
    )
    or private.is_admin()
  );

revoke all on table public.seller_payment_accounts from anon,authenticated;
grant select on table public.seller_payment_accounts to authenticated;

drop trigger if exists seller_payment_accounts_touch on public.seller_payment_accounts;
create trigger seller_payment_accounts_touch
before update on public.seller_payment_accounts
for each row execute function private.touch_updated_at();

alter table public.sellers
  drop column if exists payment_provider,
  drop column if exists payment_provider_account_id,
  drop column if exists payment_onboarding_status,
  drop column if exists charges_enabled,
  drop column if exists payouts_enabled;

create index if not exists seller_payment_accounts_onboarding_idx
  on public.seller_payment_accounts(onboarding_status)
  where onboarding_status <> 'complete';
