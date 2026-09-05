create table if not exists public.seller_part_request_leads (
  request_id uuid primary key references public.part_requests(id) on delete cascade,
  query_text text not null,
  oem_number text,
  notes text,
  status text not null,
  category_id uuid references public.categories(id) on delete set null,
  catalogue_variant_id uuid references public.vehicle_catalogue_variants(id) on delete set null,
  year smallint,
  fuel_type text,
  engine_size_simple integer,
  created_at timestamptz not null
);

alter table public.seller_part_request_leads enable row level security;

drop policy if exists "seller request leads read" on public.seller_part_request_leads;
create policy "seller request leads read"
  on public.seller_part_request_leads for select
  to authenticated
  using (
    exists (
      select 1
      from public.sellers s
      where s.owner_id=(select auth.uid())
    )
    or private.is_admin()
  );

revoke all on public.seller_part_request_leads from anon;
revoke all on public.seller_part_request_leads from authenticated;
grant select on public.seller_part_request_leads to authenticated;

create or replace function private.sync_seller_part_request_lead()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op='DELETE' then
    delete from public.seller_part_request_leads where request_id=old.id;
    return old;
  end if;

  insert into public.seller_part_request_leads(
    request_id,query_text,oem_number,notes,status,category_id,catalogue_variant_id,year,fuel_type,engine_size_simple,created_at
  )
  values(
    new.id,new.query_text,new.oem_number,new.notes,new.status,new.category_id,new.catalogue_variant_id,new.year,new.fuel_type,new.engine_size_simple,new.created_at
  )
  on conflict(request_id) do update set
    query_text=excluded.query_text,
    oem_number=excluded.oem_number,
    notes=excluded.notes,
    status=excluded.status,
    category_id=excluded.category_id,
    catalogue_variant_id=excluded.catalogue_variant_id,
    year=excluded.year,
    fuel_type=excluded.fuel_type,
    engine_size_simple=excluded.engine_size_simple;

  return new;
end;
$$;

drop trigger if exists sync_seller_part_request_lead_trigger on public.part_requests;
create trigger sync_seller_part_request_lead_trigger
after insert or update or delete on public.part_requests
for each row execute function private.sync_seller_part_request_lead();

insert into public.seller_part_request_leads(
  request_id,query_text,oem_number,notes,status,category_id,catalogue_variant_id,year,fuel_type,engine_size_simple,created_at
)
select
  id,query_text,oem_number,notes,status,category_id,catalogue_variant_id,year,fuel_type,engine_size_simple,created_at
from public.part_requests
on conflict(request_id) do update set
  query_text=excluded.query_text,
  oem_number=excluded.oem_number,
  notes=excluded.notes,
  status=excluded.status,
  category_id=excluded.category_id,
  catalogue_variant_id=excluded.catalogue_variant_id,
  year=excluded.year,
  fuel_type=excluded.fuel_type,
  engine_size_simple=excluded.engine_size_simple;

drop function if exists public.seller_open_part_request_leads();
