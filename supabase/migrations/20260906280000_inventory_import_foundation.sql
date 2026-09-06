-- Bulk inventory import foundation for CSV now and eBay/API later.

create table if not exists public.seller_inventory_imports (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  source_channel text not null check (source_channel in ('csv','ebay','api')),
  filename text,
  status text not null default 'completed' check (status in ('completed','partial','failed')),
  rows_received integer not null default 0 check (rows_received>=0),
  rows_created integer not null default 0 check (rows_created>=0),
  rows_rejected integer not null default 0 check (rows_rejected>=0),
  error_summary jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.parts
  add column if not exists source_channel text not null default 'manual'
    check (source_channel in ('manual','csv','ebay','api')),
  add column if not exists source_external_id text,
  add column if not exists import_batch_id uuid references public.seller_inventory_imports(id) on delete set null;

create unique index if not exists parts_seller_source_external_unique
  on public.parts(seller_id,source_channel,source_external_id)
  where source_external_id is not null;

create index if not exists parts_import_batch_idx
  on public.parts(import_batch_id)
  where import_batch_id is not null;

create index if not exists seller_inventory_imports_seller_created_idx
  on public.seller_inventory_imports(seller_id,created_at desc);

alter table public.seller_inventory_imports enable row level security;

drop policy if exists "seller import owner read" on public.seller_inventory_imports;
create policy "seller import owner read"
  on public.seller_inventory_imports for select
  to authenticated
  using (
    exists(
      select 1 from public.sellers s
      where s.id=seller_id and s.owner_id=(select auth.uid())
    )
    or private.is_admin()
  );

revoke all on public.seller_inventory_imports from anon,authenticated;
grant select,insert on public.seller_inventory_imports to authenticated;
