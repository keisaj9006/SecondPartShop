create extension if not exists "pgcrypto";

create type public.user_role as enum ('buyer','seller','admin');
create type public.part_condition as enum ('new','reconditioned','used');
create type public.listing_status as enum ('draft','active','reserved','sold','archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'buyer',
  display_name text not null check (char_length(display_name) between 2 and 100),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 140),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  location text not null,
  postcode text,
  description text not null default '',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.categories (id uuid primary key default gen_random_uuid(),parent_id uuid references public.categories(id) on delete set null,name text not null,slug text not null unique);
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),make text not null,model text not null,generation text not null,
  year smallint not null check (year between 1950 and 2100),engine text not null,engine_code text,
  gearbox_family text not null,gearbox_code text not null,unique(make,model,generation,year,engine,gearbox_code)
);
create table public.parts (
  id uuid primary key default gen_random_uuid(),seller_id uuid not null references public.sellers(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,title text not null check (char_length(title) between 5 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),description text not null check (char_length(description) >= 20),
  manufacturer text,part_number text,oem_number text,gearbox_family text not null,gearbox_code text not null,
  condition public.part_condition not null,price_pence integer not null check(price_pence >= 0),stock integer not null default 1 check(stock >= 0),
  status public.listing_status not null default 'draft',dispatch_days smallint not null default 2 check(dispatch_days between 0 and 30),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.part_images (id uuid primary key default gen_random_uuid(),part_id uuid not null references public.parts(id) on delete cascade,storage_path text not null unique,alt_text text not null,position smallint not null default 0,created_at timestamptz not null default now());
create table public.part_fitments (part_id uuid not null references public.parts(id) on delete cascade,vehicle_id uuid not null references public.vehicles(id) on delete cascade,notes text,primary key(part_id,vehicle_id));
create table public.saved_parts (profile_id uuid not null references public.profiles(id) on delete cascade,part_id uuid not null references public.parts(id) on delete cascade,created_at timestamptz not null default now(),primary key(profile_id,part_id));
create table public.orders (id uuid primary key default gen_random_uuid(),buyer_id uuid not null references public.profiles(id) on delete restrict,status text not null default 'pending',total_pence integer not null check(total_pence >= 0),created_at timestamptz not null default now());
create table public.order_items (id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,part_id uuid not null references public.parts(id) on delete restrict,seller_id uuid not null references public.sellers(id) on delete restrict,quantity integer not null check(quantity > 0),unit_price_pence integer not null check(unit_price_pence >= 0));

create index parts_search_idx on public.parts using gin(to_tsvector('english',coalesce(title,'')||' '||coalesce(description,'')||' '||coalesce(oem_number,'')||' '||coalesce(part_number,'')||' '||coalesce(gearbox_code,'')||' '||coalesce(gearbox_family,'')));
create index parts_marketplace_idx on public.parts(status,category_id,condition,gearbox_family,price_pence);
create index parts_seller_inventory_idx on public.parts(seller_id,status,created_at desc);
create index part_images_part_position_idx on public.part_images(part_id,position);
create index fitments_vehicle_idx on public.part_fitments(vehicle_id,part_id);
create index orders_buyer_created_idx on public.orders(buyer_id,created_at desc);
create index order_items_order_idx on public.order_items(order_id);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger sellers_touch before update on public.sellers for each row execute function private.touch_updated_at();
create trigger parts_touch before update on public.parts for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.user_role;
  requested_name text;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'role' = 'seller' then 'seller'::public.user_role
    else 'buyer'::public.user_role
  end;

  requested_name := coalesce(
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(pg_catalog.split_part(new.email, '@', 1), ''),
    'SecondPart member'
  );

  if pg_catalog.char_length(requested_name) not between 2 and 100 then
    requested_name := 'SecondPart member';
  end if;

  insert into public.profiles(id,role,display_name)
  values(new.id,requested_role,requested_name);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function private.owns_seller(requested_seller uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.sellers
    where id = requested_seller and owner_id = (select auth.uid())
  );
$$;

create or replace function private.owns_part(requested_part uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.parts p
    join public.sellers s on s.id = p.seller_id
    where p.id = requested_part and s.owner_id = (select auth.uid())
  );
$$;

create or replace function private.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not private.is_admin() then
    raise exception 'Only administrators can change account roles';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role before update on public.profiles for each row execute function private.protect_profile_role();

revoke all on function private.touch_updated_at() from public;
revoke all on function private.handle_new_user() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.owns_seller(uuid) from public;
revoke all on function private.owns_part(uuid) from public;
revoke all on function private.protect_profile_role() from public;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.owns_seller(uuid) to authenticated;
grant execute on function private.owns_part(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.sellers enable row level security;
alter table public.categories enable row level security;
alter table public.vehicles enable row level security;
alter table public.parts enable row level security;
alter table public.part_images enable row level security;
alter table public.part_fitments enable row level security;
alter table public.saved_parts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "profiles select own" on public.profiles for select to authenticated using(id=(select auth.uid()) or private.is_admin());
create policy "profiles update own" on public.profiles for update to authenticated using(id=(select auth.uid()) or private.is_admin()) with check(id=(select auth.uid()) or private.is_admin());
create policy "sellers public read" on public.sellers for select to anon,authenticated using(true);
create policy "sellers create own" on public.sellers for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('seller','admin')));
create policy "sellers update own" on public.sellers for update to authenticated using(owner_id=(select auth.uid()) or private.is_admin()) with check(owner_id=(select auth.uid()) or private.is_admin());
create policy "categories public read" on public.categories for select to anon,authenticated using(true);
create policy "categories admin write" on public.categories for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy "vehicles public read" on public.vehicles for select to anon,authenticated using(true);
create policy "vehicles admin write" on public.vehicles for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy "parts public read active" on public.parts for select to anon,authenticated using(status='active');
create policy "parts owner read" on public.parts for select to authenticated using(private.owns_seller(seller_id) or private.is_admin());
create policy "parts owner create" on public.parts for insert to authenticated with check(private.owns_seller(seller_id) or private.is_admin());
create policy "parts owner update" on public.parts for update to authenticated using(private.owns_seller(seller_id) or private.is_admin()) with check(private.owns_seller(seller_id) or private.is_admin());
create policy "parts owner delete" on public.parts for delete to authenticated using(private.owns_seller(seller_id) or private.is_admin());
create policy "images public read active" on public.part_images for select to anon,authenticated using(exists(select 1 from public.parts p where p.id=part_images.part_id and p.status='active'));
create policy "images owner read" on public.part_images for select to authenticated using(private.owns_part(part_id) or private.is_admin());
create policy "images owner create" on public.part_images for insert to authenticated with check(private.owns_part(part_id) or private.is_admin());
create policy "images owner update" on public.part_images for update to authenticated using(private.owns_part(part_id) or private.is_admin()) with check(private.owns_part(part_id) or private.is_admin());
create policy "images owner delete" on public.part_images for delete to authenticated using(private.owns_part(part_id) or private.is_admin());
create policy "fitments public read active" on public.part_fitments for select to anon,authenticated using(exists(select 1 from public.parts p where p.id=part_fitments.part_id and p.status='active'));
create policy "fitments owner read" on public.part_fitments for select to authenticated using(private.owns_part(part_id) or private.is_admin());
create policy "fitments owner create" on public.part_fitments for insert to authenticated with check(private.owns_part(part_id) or private.is_admin());
create policy "fitments owner delete" on public.part_fitments for delete to authenticated using(private.owns_part(part_id) or private.is_admin());
create policy "saved parts select own" on public.saved_parts for select to authenticated using(profile_id=(select auth.uid()));
create policy "saved parts create own" on public.saved_parts for insert to authenticated with check(profile_id=(select auth.uid()));
create policy "saved parts delete own" on public.saved_parts for delete to authenticated using(profile_id=(select auth.uid()));
create policy "orders buyer read" on public.orders for select to authenticated using(buyer_id=(select auth.uid()) or private.is_admin());
create policy "order items buyer read" on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_items.order_id and o.buyer_id=(select auth.uid())) or private.is_admin());

revoke all on table public.profiles,public.sellers,public.categories,public.vehicles,public.parts,public.part_images,public.part_fitments,public.saved_parts,public.orders,public.order_items from anon,authenticated;
grant usage on schema public to anon,authenticated;
grant select on table public.sellers,public.categories,public.vehicles,public.parts,public.part_images,public.part_fitments to anon;
grant select on table public.profiles,public.sellers,public.categories,public.vehicles,public.parts,public.part_images,public.part_fitments,public.saved_parts,public.orders,public.order_items to authenticated;
grant update on table public.profiles to authenticated;
grant insert,update on table public.sellers to authenticated;
grant insert,update,delete on table public.categories,public.vehicles,public.parts,public.part_images,public.part_fitments to authenticated;
grant insert,delete on table public.saved_parts to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('part-images','part-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "part images seller read" on storage.objects for select to authenticated using(bucket_id='part-images' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('seller','admin')));
create policy "part images seller upload" on storage.objects for insert to authenticated with check(bucket_id='part-images' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('seller','admin')));
create policy "part images seller update" on storage.objects for update to authenticated using(bucket_id='part-images' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('seller','admin'))) with check(bucket_id='part-images' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('seller','admin')));
create policy "part images seller delete" on storage.objects for delete to authenticated using(bucket_id='part-images' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('seller','admin')));
