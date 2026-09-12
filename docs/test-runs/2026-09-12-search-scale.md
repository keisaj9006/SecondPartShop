# Marketplace search 25,000-listing scale probe — 12 September 2026

Status: PASS for the isolated reduced-schema PGlite boundary. Hosted Supabase latency, network delivery and concurrent-load capacity remain open.

## Scope and method

Command:

```powershell
node scripts/benchmark-marketplace-scale.mjs
```

The probe creates one in-memory PGlite database through the existing marketplace search SQL harness, inserts exactly 25,000 deterministic active listings, and applies `supabase/migrations/20260912110440_complete_marketplace_search_page.sql` unchanged. The loaded migration SHA256 was `4fa2500e004571a1dcd4846ee68238aaf5d49c24f4ee351f5fbaf988465b6eee`.

Every listing has the exact title `Scale alternator`. Prices are unique and equal to the numeric fixture ID; timestamps decrease by one second per ID. Listing 25,000 also has compact OEM identifier `SCALE-OEM-25000` and a second category. Those independent fixture facts make the expected filtered identifier result and `best`, `price_asc` and `price_desc` orders deterministic. The function is called directly with its current typed arguments. No shared Supabase project, provider, account or marketplace listing was read or mutated.

## Result

All assertions passed with process exit code 0:

| Query | Limit / offset | Returned rows | Expected boundary IDs | PGlite time |
| --- | ---: | ---: | --- | ---: |
| Compact OEM plus category filter | 24 / 0 | 1 | 25,000 | 468.0 ms |
| `best` first page | 24 / 0 | 25 | 1 through 25 | 2,151.6 ms |
| `price_desc` clamped page | 1,000 / 0 | 61 | 25,000 through 24,940 | 1,730.1 ms |
| `price_asc` deep page | 24 / 24,960 | 25 | 24,961 through 24,985 | 1,634.4 ms |
| `price_desc` deep page | 24 / 24,960 | 25 | 40 through 16 | 2,093.9 ms |
| `best` terminal page | 24 / 24,984 | 16 | 24,985 through 25,000 | 3,030.9 ms |

The 25- and 61-row results include the function's one-row pagination sentinel. The requested limit is capped at 60 before that sentinel is added. The terminal page returns only the 16 remaining listings. Full returned ID sequences matched the fixture-derived global order, including both deep pages.

Setup timings were 8,017.9 ms for the reduced-schema harness, 7,860.1 ms to seed 25,000 rows, 18.8 ms to apply the current migration and 462.5 ms for `ANALYZE public.parts`. Total process time was 27,601.5 ms. Timings are single observations and are recorded as diagnostics rather than release thresholds.

## Runtime metadata

- Node.js `v24.20.0`, Windows x64, four logical CPUs.
- PGlite package `0.5.8`.
- PostgreSQL `18.3` on 32-bit `wasm32-unknown-emscripten`; `pg_trgm` `1.6`.
- Process RSS after the queries: 401.4 MiB. This includes Node.js, WASM and harness overhead.
- Preview uses hosted PostgreSQL `17.6`, so the local runtime is not version-identical.

## Evidence boundary

This run proves that the checked-in function executes against 25,000 eligible matches in the existing reduced schema, retains the compact-OEM source under a category filter, keeps result pages bounded, and applies deterministic global ordering before deep `OFFSET` pagination. It also proves that the historical 500-result cap symptom is absent at this local boundary.

It does not establish a hosted latency target, production query plan, disk or cache behavior, PostgREST/JWT serialization, image delivery, realistic category/seller/fitment distributions, or concurrent-user capacity. PGlite is an in-process single-client WASM runtime, and the fixture uses one seller and two categories. A hosted PostgreSQL 17.6 benchmark with representative distributions and controlled concurrent load remains required before claiming production-scale capacity.
