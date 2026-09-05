create table if not exists public.marketplace_search_synonyms (
  alias text primary key,
  canonical_query text not null,
  created_at timestamptz not null default now(),
  check (alias=lower(alias)),
  check (char_length(alias) between 2 and 80),
  check (char_length(canonical_query) between 2 and 120)
);

alter table public.marketplace_search_synonyms enable row level security;

drop policy if exists "marketplace search synonyms public read" on public.marketplace_search_synonyms;
create policy "marketplace search synonyms public read"
  on public.marketplace_search_synonyms for select
  to anon,authenticated
  using (true);

drop policy if exists "marketplace search synonyms admin insert" on public.marketplace_search_synonyms;
create policy "marketplace search synonyms admin insert"
  on public.marketplace_search_synonyms for insert
  to authenticated
  with check (private.is_admin());

drop policy if exists "marketplace search synonyms admin update" on public.marketplace_search_synonyms;
create policy "marketplace search synonyms admin update"
  on public.marketplace_search_synonyms for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "marketplace search synonyms admin delete" on public.marketplace_search_synonyms;
create policy "marketplace search synonyms admin delete"
  on public.marketplace_search_synonyms for delete
  to authenticated
  using (private.is_admin());

grant select on public.marketplace_search_synonyms to anon,authenticated;
grant insert,update,delete on public.marketplace_search_synonyms to authenticated;

insert into public.marketplace_search_synonyms(alias,canonical_query) values
 ('wing mirror','door mirror'),
 ('side mirror','door mirror'),
 ('door mirror','door mirror'),
 ('gear box','gearbox'),
 ('transmission','gearbox'),
 ('shock','shock absorber'),
 ('shocks','shock absorber'),
 ('damper','shock absorber'),
 ('starter','starter motor'),
 ('cat','catalytic converter'),
 ('alternator belt','drive belt'),
 ('aux belt','drive belt'),
 ('auxiliary belt','drive belt'),
 ('wishbone','control arm'),
 ('track rod','tie rod'),
 ('drop link','anti roll bar link'),
 ('anti-roll bar link','anti roll bar link'),
 ('cv shaft','driveshaft'),
 ('drive shaft','driveshaft'),
 ('headlamp','headlight'),
 ('rear light','tail light'),
 ('brake rotor','brake disc'),
 ('rotor','brake disc'),
 ('brake pads','brake pad'),
 ('pads','brake pad'),
 ('oil filter','oil filter'),
 ('pollen filter','cabin filter'),
 ('cabin filter','cabin filter'),
 ('fuel injector','injector'),
 ('injectors','injector'),
 ('waterpump','water pump'),
 ('fly wheel','flywheel'),
 ('clutch kit','clutch assembly'),
 ('ecu','engine control unit'),
 ('tcu','transmission control unit'),
 ('dpf','diesel particulate filter'),
 ('maf','mass air flow sensor'),
 ('lambda sensor','oxygen sensor'),
 ('o2 sensor','oxygen sensor')
on conflict(alias) do update set canonical_query=excluded.canonical_query;
