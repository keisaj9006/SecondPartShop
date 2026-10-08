export const garageIdentityFixture=`
 create role anon nologin nosuperuser nobypassrls;
 create role authenticated nologin nosuperuser nobypassrls;
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated;
 create table public.profiles(id uuid primary key);
 create table public.vehicle_catalogue_variants(id uuid primary key,provider text,body_type text,make text,model_family text,variant text);
 create table public.vehicle_catalogue_years(variant_id uuid references public.vehicle_catalogue_variants(id),year_first_used smallint,primary key(variant_id,year_first_used));
 create table public.vehicle_catalogue_engines(variant_id uuid references public.vehicle_catalogue_variants(id),fuel_type text,engine_size_simple integer);
 grant select on public.vehicle_catalogue_variants,public.vehicle_catalogue_years,public.vehicle_catalogue_engines to authenticated;
`;
