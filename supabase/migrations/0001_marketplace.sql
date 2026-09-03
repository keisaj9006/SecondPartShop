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
create index fitments_vehicle_idx on public.part_fitments(vehicle_id,part_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger sellers_touch before update on public.sellers for each row execute function public.touch_updated_at();
create trigger parts_touch before update on public.parts for each row execute function public.touch_updated_at();
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,role,display_name) values(new.id,coalesce((new.raw_user_meta_data->>'role')::public.user_role,'buyer'),coalesce(nullif(new.raw_user_meta_data->>'display_name',''),split_part(new.email,'@',1)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;
create or replace function public.owns_seller(requested_seller uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.sellers where id=requested_seller and owner_id=auth.uid()); $$;
create or replace function public.protect_profile_role() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.role <> old.role and not public.is_admin() then raise exception 'Only administrators can change account roles'; end if;
  return new;
end; $$;
create trigger profiles_protect_role before update on public.profiles for each row execute function public.protect_profile_role();

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

create policy "profiles select own" on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles for update using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());
create policy "sellers public read" on public.sellers for select using(true);
create policy "sellers create own" on public.sellers for insert with check(owner_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and role in ('seller','admin')));
create policy "sellers update own" on public.sellers for update using(owner_id=auth.uid() or public.is_admin()) with check(owner_id=auth.uid() or public.is_admin());
create policy "categories public read" on public.categories for select using(true);
create policy "categories admin write" on public.categories for all using(public.is_admin()) with check(public.is_admin());
create policy "vehicles public read" on public.vehicles for select using(true);
create policy "vehicles admin write" on public.vehicles for all using(public.is_admin()) with check(public.is_admin());
create policy "parts public or owner read" on public.parts for select using(status='active' or public.owns_seller(seller_id) or public.is_admin());
create policy "parts owner create" on public.parts for insert with check(public.owns_seller(seller_id) or public.is_admin());
create policy "parts owner update" on public.parts for update using(public.owns_seller(seller_id) or public.is_admin()) with check(public.owns_seller(seller_id) or public.is_admin());
create policy "parts owner delete" on public.parts for delete using(public.owns_seller(seller_id) or public.is_admin());
create policy "images public or owner read" on public.part_images for select using(exists(select 1 from public.parts p where p.id=part_images.part_id and (p.status='active' or public.owns_seller(p.seller_id) or public.is_admin())));
create policy "images owner create" on public.part_images for insert with check(exists(select 1 from public.parts p where p.id=part_images.part_id and (public.owns_seller(p.seller_id) or public.is_admin())));
create policy "images owner update" on public.part_images for update using(exists(select 1 from public.parts p where p.id=part_images.part_id and (public.owns_seller(p.seller_id) or public.is_admin())));
create policy "images owner delete" on public.part_images for delete using(exists(select 1 from public.parts p where p.id=part_images.part_id and (public.owns_seller(p.seller_id) or public.is_admin())));
create policy "fitments public or owner read" on public.part_fitments for select using(exists(select 1 from public.parts p where p.id=part_fitments.part_id and (p.status='active' or public.owns_seller(p.seller_id) or public.is_admin())));
create policy "fitments owner create" on public.part_fitments for insert with check(exists(select 1 from public.parts p where p.id=part_fitments.part_id and (public.owns_seller(p.seller_id) or public.is_admin())));
create policy "fitments owner delete" on public.part_fitments for delete using(exists(select 1 from public.parts p where p.id=part_fitments.part_id and (public.owns_seller(p.seller_id) or public.is_admin())));
create policy "saved parts own rows" on public.saved_parts for all using(profile_id=auth.uid()) with check(profile_id=auth.uid());
create policy "orders buyer read" on public.orders for select using(buyer_id=auth.uid() or public.is_admin());
create policy "order items buyer read" on public.order_items for select using(exists(select 1 from public.orders o where o.id=order_items.order_id and (o.buyer_id=auth.uid() or public.is_admin())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('part-images','part-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "part images public read" on storage.objects for select using(bucket_id='part-images');
create policy "part images owner upload" on storage.objects for insert to authenticated with check(bucket_id='part-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "part images owner update" on storage.objects for update to authenticated using(bucket_id='part-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "part images owner delete" on storage.objects for delete to authenticated using(bucket_id='part-images' and (storage.foldername(name))[1]=auth.uid()::text);
