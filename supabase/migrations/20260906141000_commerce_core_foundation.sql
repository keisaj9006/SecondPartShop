-- Commerce core foundation. No payment capture occurs in this migration.

alter table public.sellers
  add column if not exists payment_provider text,
  add column if not exists payment_provider_account_id text,
  add column if not exists payment_onboarding_status text not null default 'not_started',
  add column if not exists charges_enabled boolean not null default false,
  add column if not exists payouts_enabled boolean not null default false;

alter table public.sellers
  drop constraint if exists sellers_payment_provider_check;
alter table public.sellers
  add constraint sellers_payment_provider_check
  check (payment_provider is null or payment_provider in ('stripe'));

alter table public.sellers
  drop constraint if exists sellers_payment_onboarding_status_check;
alter table public.sellers
  add constraint sellers_payment_onboarding_status_check
  check (payment_onboarding_status in ('not_started','pending','restricted','complete'));

create unique index if not exists sellers_payment_provider_account_unique
  on public.sellers(payment_provider,payment_provider_account_id)
  where payment_provider_account_id is not null;

create or replace function private.protect_seller_commerce_state()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is not null
     and not private.is_admin()
     and (
       new.payment_provider is distinct from old.payment_provider
       or new.payment_provider_account_id is distinct from old.payment_provider_account_id
       or new.payment_onboarding_status is distinct from old.payment_onboarding_status
       or new.charges_enabled is distinct from old.charges_enabled
       or new.payouts_enabled is distinct from old.payouts_enabled
     ) then
    raise exception 'Seller payment status can only be changed by the payment integration or an administrator.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_seller_commerce_state_trigger on public.sellers;
create trigger protect_seller_commerce_state_trigger
before update on public.sellers
for each row execute function private.protect_seller_commerce_state();

revoke all on function private.protect_seller_commerce_state() from public;

alter table public.orders
  add column if not exists currency text not null default 'GBP',
  add column if not exists subtotal_pence integer not null default 0,
  add column if not exists shipping_pence integer not null default 0,
  add column if not exists platform_fee_pence integer not null default 0,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_provider text,
  add column if not exists provider_checkout_session_id text,
  add column if not exists provider_payment_intent_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.orders
  drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in (
    'pending_payment','paid','processing','partially_fulfilled',
    'completed','cancelled','partially_refunded','refunded','disputed'
  ));

alter table public.orders
  alter column status set default 'pending_payment';

alter table public.orders
  drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in (
    'unpaid','requires_action','processing','paid',
    'partially_refunded','refunded','failed','cancelled','disputed'
  ));

alter table public.orders
  drop constraint if exists orders_currency_check;
alter table public.orders
  add constraint orders_currency_check
  check (currency ~ '^[A-Z]{3}$');

alter table public.orders
  drop constraint if exists orders_amounts_nonnegative;
alter table public.orders
  add constraint orders_amounts_nonnegative
  check (
    total_pence >= 0
    and subtotal_pence >= 0
    and shipping_pence >= 0
    and platform_fee_pence >= 0
  );

create unique index if not exists orders_checkout_session_unique
  on public.orders(provider_checkout_session_id)
  where provider_checkout_session_id is not null;
create index if not exists orders_payment_intent_idx
  on public.orders(provider_payment_intent_id)
  where provider_payment_intent_id is not null;

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch
before update on public.orders
for each row execute function private.touch_updated_at();

alter table public.order_items
  add column if not exists delivery_method text not null default 'shipping',
  add column if not exists shipping_pence integer not null default 0,
  add column if not exists platform_fee_pence integer not null default 0,
  add column if not exists seller_net_pence integer not null default 0,
  add column if not exists tracking_carrier text,
  add column if not exists tracking_number text,
  add column if not exists release_eligible_at timestamptz,
  add column if not exists payout_status text not null default 'not_ready',
  add column if not exists provider_transfer_id text,
  add column if not exists return_requested_at timestamptz,
  add column if not exists dispute_opened_at timestamptz;

alter table public.order_items
  drop constraint if exists order_items_delivery_method_check;
alter table public.order_items
  add constraint order_items_delivery_method_check
  check (delivery_method in ('shipping','collection'));

alter table public.order_items
  drop constraint if exists order_items_payout_status_check;
alter table public.order_items
  add constraint order_items_payout_status_check
  check (payout_status in ('not_ready','scheduled','released','reversed','blocked'));

alter table public.order_items
  drop constraint if exists order_items_amounts_nonnegative;
alter table public.order_items
  add constraint order_items_amounts_nonnegative
  check (
    shipping_pence >= 0
    and platform_fee_pence >= 0
    and seller_net_pence >= 0
  );

create unique index if not exists order_items_transfer_unique
  on public.order_items(provider_transfer_id)
  where provider_transfer_id is not null;
create index if not exists order_items_release_queue_idx
  on public.order_items(payout_status,release_eligible_at)
  where payout_status in ('not_ready','scheduled');

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_created_idx
  on public.order_events(order_id,created_at desc);
create index if not exists order_events_item_created_idx
  on public.order_events(order_item_id,created_at desc)
  where order_item_id is not null;

alter table public.order_events enable row level security;

drop policy if exists "order events buyer read" on public.order_events;
create policy "order events buyer read"
  on public.order_events for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id=order_events.order_id
        and o.buyer_id=(select auth.uid())
    )
    or private.is_admin()
  );

drop policy if exists "order events seller read" on public.order_events;
create policy "order events seller read"
  on public.order_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.order_items oi
      join public.sellers s on s.id=oi.seller_id
      where oi.order_id=order_events.order_id
        and s.owner_id=(select auth.uid())
    )
  );

grant select on public.order_events to authenticated;
