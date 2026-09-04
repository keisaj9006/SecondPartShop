create type public.vehicle_data_status as enum ('verified', 'qa_seed', 'external_import');
alter table public.categories add column is_transmission_related boolean not null default false;
update public.categories set is_transmission_related=true where slug in ('complete-gearboxes','mechatronic-units','clutch-assemblies','valve-bodies','repair-kits','oil-pumps');
comment on column public.categories.is_transmission_related is 'Controls whether gearbox-specific search and listing fields are relevant for this category.';
alter table public.vehicles add column fuel_type text, add column data_status public.vehicle_data_status not null default 'qa_seed', add column source_reference text, alter column gearbox_family drop not null, alter column gearbox_code drop not null;
comment on table public.vehicles is 'Vehicle/engine variants used for manual selection and part fitment. Transmission data is optional and normalized in vehicle_transmissions.';
comment on column public.vehicles.data_status is 'verified = checked source data; qa_seed = interface test fixture; external_import = imported provider data awaiting normal application use.';
comment on column public.vehicles.source_reference is 'Provider or dataset identifier used for provenance; never a registration number.';
comment on column public.vehicles.gearbox_family is 'Legacy compatibility column retained during the rebuild. New transmission variants belong in vehicle_transmissions.';
comment on column public.vehicles.gearbox_code is 'Legacy compatibility column retained during the rebuild. New transmission variants belong in vehicle_transmissions.';
alter table public.vehicles drop constraint vehicles_make_model_generation_year_engine_gearbox_code_key;
create unique index vehicles_identity_idx on public.vehicles(make,model,generation,year,engine,coalesce(engine_code,''));
create index vehicles_manual_selector_idx on public.vehicles(make,model,generation,year,engine);
create table public.vehicle_transmissions (
 id uuid primary key default gen_random_uuid(),
 vehicle_id uuid not null references public.vehicles(id) on delete cascade,
 family text not null,
 code text not null,
 transmission_type text,
 data_status public.vehicle_data_status not null default 'qa_seed',
 source_reference text,
 created_at timestamptz not null default now(),
 unique(vehicle_id,family,code)
);
comment on table public.vehicle_transmissions is 'Optional transmission variants for categories where gearbox compatibility is relevant.';
insert into public.vehicle_transmissions(vehicle_id,family,code,data_status)
select id,gearbox_family,gearbox_code,data_status from public.vehicles
where gearbox_family is not null and gearbox_code is not null
on conflict(vehicle_id,family,code) do nothing;
alter table public.part_fitments add column transmission_id uuid references public.vehicle_transmissions(id) on delete set null;
update public.part_fitments as fitment
set transmission_id=transmission.id
from public.vehicle_transmissions as transmission
join public.parts as part on true
where fitment.part_id=part.id
 and fitment.vehicle_id=transmission.vehicle_id
 and part.gearbox_family ilike '%'||transmission.family||'%'
 and part.gearbox_code ilike '%'||transmission.code||'%';
create index part_fitments_transmission_idx on public.part_fitments(transmission_id) where transmission_id is not null;
alter table public.parts alter column gearbox_family drop not null, alter column gearbox_code drop not null;
alter table public.vehicle_transmissions enable row level security;
create policy "vehicle transmissions anon read" on public.vehicle_transmissions for select to anon using(true);
create policy "vehicle transmissions authenticated read" on public.vehicle_transmissions for select to authenticated using(true);
create policy "vehicle transmissions admin insert" on public.vehicle_transmissions for insert to authenticated with check(private.is_admin());
create policy "vehicle transmissions admin update" on public.vehicle_transmissions for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy "vehicle transmissions admin delete" on public.vehicle_transmissions for delete to authenticated using(private.is_admin());
revoke all on table public.vehicle_transmissions from anon,authenticated;
grant select on table public.vehicle_transmissions to anon,authenticated;
grant insert,update,delete on table public.vehicle_transmissions to authenticated;
insert into public.categories(id,name,slug,is_transmission_related) values
 ('10000000-0000-0000-0000-000000000007','Body & Exterior','body-exterior',false),
 ('10000000-0000-0000-0000-000000000008','Lighting','lighting',false),
 ('10000000-0000-0000-0000-000000000009','Electrical','electrical',false),
 ('10000000-0000-0000-0000-000000000010','Suspension & Steering','suspension-steering',false),
 ('10000000-0000-0000-0000-000000000011','Brakes','brakes',false),
 ('10000000-0000-0000-0000-000000000012','Engine Components','engine-components',false),
 ('10000000-0000-0000-0000-000000000013','Cooling & Heating','cooling-heating',false),
 ('10000000-0000-0000-0000-000000000014','Interior','interior',false),
 ('10000000-0000-0000-0000-000000000015','Exhaust & Emissions','exhaust-emissions',false)
on conflict(id) do update set name=excluded.name,slug=excluded.slug,is_transmission_related=excluded.is_transmission_related;
insert into public.vehicles(id,make,model,generation,year,engine,engine_code,fuel_type,gearbox_family,gearbox_code,data_status,source_reference) values
 ('30000000-0000-0000-0000-000000000009','Ford','Fiesta','Mk7',2018,'1.0 EcoBoost',null,'Petrol',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000010','Ford','Fiesta','Mk7',2018,'1.5 TDCi',null,'Diesel',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000011','Ford','Focus','Mk4',2020,'1.5 EcoBlue',null,'Diesel',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000012','BMW','3 Series','G20',2020,'320d',null,'Diesel',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000013','BMW','3 Series','G20',2021,'330e',null,'Plug-in hybrid',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000014','Mercedes-Benz','C-Class','W205',2019,'C 220 d',null,'Diesel',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000015','Vauxhall','Astra','K',2019,'1.4 Turbo',null,'Petrol',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000016','Toyota','Corolla','E210',2021,'1.8 Hybrid',null,'Hybrid',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000017','Nissan','Qashqai','J11',2019,'1.3 DIG-T',null,'Petrol',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000018','Land Rover','Range Rover Evoque','L551',2020,'2.0 D180',null,'Diesel',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000019','Kia','Sportage','QL',2019,'1.6 CRDi',null,'Diesel',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000020','Hyundai','Tucson','TL',2019,'1.6 T-GDi',null,'Petrol',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000021','Volvo','XC40','Mk1',2021,'T3',null,'Petrol',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000022','Peugeot','3008','Mk2',2020,'1.5 BlueHDi',null,'Diesel',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000023','Renault','Clio','Mk5',2021,'1.0 TCe',null,'Petrol',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000024','Honda','Civic','Mk10',2019,'1.5 VTEC Turbo',null,'Petrol',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000025','Mazda','CX-5','KF',2020,'2.0 Skyactiv-G',null,'Petrol',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000026','Volkswagen','Golf','Mk7',2017,'1.4 TSI',null,'Petrol',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000027','Volkswagen','Golf','Mk8',2021,'1.5 TSI',null,'Petrol',null,null,'qa_seed','secondpart-qa-catalogue-v1'),
 ('30000000-0000-0000-0000-000000000028','Audi','A3','8Y',2021,'1.5 TFSI',null,'Petrol',null,null,'qa_seed','secondpart-qa-catalogue-v1')
on conflict(id) do update set make=excluded.make,model=excluded.model,generation=excluded.generation,year=excluded.year,engine=excluded.engine,engine_code=excluded.engine_code,fuel_type=excluded.fuel_type,gearbox_family=excluded.gearbox_family,gearbox_code=excluded.gearbox_code,data_status=excluded.data_status,source_reference=excluded.source_reference;
update public.vehicles set fuel_type=case id
 when '30000000-0000-0000-0000-000000000001' then 'Diesel'
 when '30000000-0000-0000-0000-000000000002' then 'Diesel'
 when '30000000-0000-0000-0000-000000000003' then 'Diesel'
 when '30000000-0000-0000-0000-000000000004' then 'Petrol'
 when '30000000-0000-0000-0000-000000000005' then 'Petrol'
 when '30000000-0000-0000-0000-000000000006' then 'Petrol'
 when '30000000-0000-0000-0000-000000000007' then 'Diesel'
 when '30000000-0000-0000-0000-000000000008' then 'Diesel'
 else fuel_type end,
 data_status='qa_seed',
 source_reference=coalesce(source_reference,'secondpart-qa-catalogue-v1')
where id between '30000000-0000-0000-0000-000000000001' and '30000000-0000-0000-0000-000000000008';