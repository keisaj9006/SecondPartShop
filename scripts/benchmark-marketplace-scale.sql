-- Marketplace scale benchmark.
-- SAFE FOR A NON-PRODUCTION BENCHMARK SESSION: uses a TEMP table only.
-- It does not insert synthetic rows into public.parts.
--
-- Compare deep OFFSET pagination with keyset/cursor pagination at 100k rows.
-- Run with EXPLAIN (ANALYZE, BUFFERS) in a staging/dev Supabase SQL session.

create temporary table benchmark_marketplace_parts(
  id bigint primary key,
  created_at timestamptz not null,
  status text not null,
  category_id int not null,
  price_pence int not null
) on commit drop;

insert into benchmark_marketplace_parts(id,created_at,status,category_id,price_pence)
select
  g,
  now()-(g::text||' seconds')::interval,
  'active',
  (g%50)::int,
  1000+(g%200000)::int
from generate_series(1,100000) g;

create index benchmark_marketplace_created_idx
  on benchmark_marketplace_parts(created_at desc,id desc)
  where status='active';

analyze benchmark_marketplace_parts;

-- Deep OFFSET: PostgreSQL must walk the skipped rows.
explain (analyze,buffers)
select id,created_at
from benchmark_marketplace_parts
where status='active'
order by created_at desc,id desc
offset 90000 limit 24;

-- Cursor/keyset: PostgreSQL can seek directly into the ordered index.
explain (analyze,buffers)
select id,created_at
from benchmark_marketplace_parts
where status='active'
  and (created_at,id)<(
    now()-('90000 seconds')::interval,
    90000
  )
order by created_at desc,id desc
limit 24;
