export const disputeRecoverySchema=`
  create schema private;
  create role anon nologin nosuperuser nobypassrls;
  create role authenticated nologin nosuperuser nobypassrls;
  create role service_role nologin nosuperuser bypassrls;
  grant usage on schema public to anon,authenticated,service_role;

  create function private.recompute_order_status(uuid) returns void
  language plpgsql security definer set search_path='' as $$begin return; end$$;

  create table public.payment_events(
   provider text not null,provider_event_id text not null unique,event_type text not null,payload_ref jsonb
  );
  create table public.orders(
   id uuid primary key,buyer_id uuid,payment_status text not null,status text not null,provider_charge_id text unique
  );
  create table public.sellers(id uuid primary key,owner_id uuid);
  create table public.parts(id uuid primary key,seller_id uuid not null,title text not null);
  create table public.order_items(
   id uuid primary key,order_id uuid not null,part_id uuid not null,seller_id uuid not null,
   fulfilment_status text not null,payout_status text not null,funds_released_at timestamptz,
   release_eligible_at timestamptz,provider_transfer_id text,provider_transfer_reversal_id text,
   payout_rollback_required boolean not null default false,dispute_opened_at timestamptz,seller_net_pence integer not null default 500
  );
  create table public.transaction_cases(
   id uuid primary key default gen_random_uuid(),order_item_id uuid not null,opened_by uuid not null,
   case_type text not null,reason text,details text,status text not null,previous_fulfilment_status text,
   resolution_notes text,resolution text,resolved_at timestamptz,created_at timestamptz not null default now(),
   provider_transfer_reversal_id text
  );
  create unique index transaction_cases_one_open_per_item on public.transaction_cases(order_item_id)
   where status in ('open','seller_response','under_review','return_authorized','return_shipped','returned');
  create table public.order_events(
   order_id uuid not null,order_item_id uuid,event_type text not null,from_status text,to_status text,
   metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
  );
  create table public.notifications(
   profile_id uuid,type text,title text,body text,href text,dedupe_key text unique
  );
  create table public.profiles(id uuid primary key,role text);

  insert into public.sellers values('50000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000002');
  insert into public.parts values('50000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000003','Used ABS pump');`;
