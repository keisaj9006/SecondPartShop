-- Reduced schema additions to real base CREATE TABLE statements loaded by the harness.
-- Only auth.uid()/auth.users substitute the unavailable Supabase Auth boundary.
-- No Storage, payment mutation triggers, providers, or auth lifecycle are replayed.
alter table public.categories add column search_terms text[] not null default '{}';
alter table public.vehicles add column fuel_type text;
alter table public.parts alter column gearbox_family drop not null;
alter table public.parts alter column gearbox_code drop not null;
alter table public.parts add column donor_vehicle_id uuid references public.donor_vehicles(id) on delete set null;
alter table public.sellers add column account_deleted_at timestamptz;
alter table public.sellers add column latitude double precision;
alter table public.sellers add column longitude double precision;
alter table public.sellers add column postcode_geocode_approximate boolean not null default false;
alter table public.orders add column payment_status text not null default 'unpaid';
alter table public.order_items add column fulfilment_status text not null default 'pending';
alter table public.order_items add column payout_status text not null default 'not_ready';
alter table public.order_items add column funds_released_at timestamptz;
alter table public.order_items add column refunded_at timestamptz;
alter table public.parts enable row level security;
alter table public.sellers enable row level security;
alter table public.profiles enable row level security;
grant select on public.parts,public.sellers,public.categories,public.vehicles,public.part_fitments to anon,authenticated;
