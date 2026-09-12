# Search completeness and ordering QA — 12 September 2026

Status: implementation, independent semantic review and local verification PASS; deployed application acceptance pending.

Baseline app commit `b210f76b3790494c28e3a206d760b0bd60d0bc1f`, CI `34689843775` success, READY deployment `dpl_BhrpGAHnAYespxh2gWjkC6k5txtk`, both Preview aliases verified.

Public mobile marketplace GET for `q=DSG&limit=10` returned HTTP 200 and the same price sequence for `best`, `price_asc`, `price_desc` and `warranty`: 18,900; 124,900; 68,900 pence (IDs ending 005, 001, 002). Both requested price orders are therefore incorrect. The existing three public offers suffice for this deployed baseline; no fixture inventory was added or changed. All three have warranty 0 and null delivery, so that sample does not establish warranty/delivery correctness.

Current effective search indexes were inspected on Preview: stored active search_document GIN; title/manufacturer trigrams; compact OEM/part-number partial trigrams; gearbox code/family partial trigrams; active category-created, price, delivery and warranty indexes. Preserve the indexed expressions and partial predicates rather than adding duplicates.

The implementation uses pinned dev-only PGlite 0.5.8 for actual SQL tests on a reduced local schema. That engine is PostgreSQL 18.3; Preview is PostgreSQL 17.6. These tests must not be described as a full Supabase migration replay, independent-session concurrency or a 100k-listing capacity benchmark. Shared Preview receives no bulk synthetic inventory.
Actual browser baseline also confirmed: selecting Price: high to low and Apply produces sort=price_desc, but the three marketplace cards remain £189, £1249, £689. Recently viewed cards are a separate section and are excluded from this ordering assertion.
Related fail-closed baseline: public mobile GET q=DSG&cv=invalid-qa-variant&cy=2017&fit=1&limit=10 returned HTTP200, ok:true, vehicle:null and three unrestricted items. The raw invalid catalogue intent was discarded before the search boundary. Search-specific caller guards must reject this without changing intentional Home addVehicle=1 or no-query browse behavior.

## Verified implementation

One bounded search RPC now applies complete eligibility, canonical fitment evidence and global sorting before pagination. It preserves the existing eight text predicates, twelve scoring tiers and global literal-before-synonym fallback. Hydration includes only visible IDs; grouping retains search order and derives price extrema independently. Explicit invalid catalogue/year/engine context fails closed at the actual Home and mobile callers, including lookup failure and fit=0. No-query browse and intentional addVehicle=1 behavior remain unchanged.

Independent SQL and application/caller/harness semantic reviews: PASS, no outstanding findings. Final local verification: 228/228 tests, lint (zero errors, three existing mobile-shell warnings), typecheck, production build, git diff --check and all 14 repository validators PASS. Regression coverage includes 501/525/1601-row completeness and pagination, global sorts, alias fallback, canonical transaction-backed evidence, bounded hydration, grouped presentation and 31 Home/mobile caller cases. Distance-v2 invalidation parity is a source assertion, not an executed invalidation scenario for that RPC.

Preview-only migration: local `20260912110440_complete_marketplace_search_page.sql` applied as `20260912113148_complete_marketplace_search_page` to `etkupijfdznljimrfyct`. Local SHA256 `4fa2500e004571a1dcd4846ee68238aaf5d49c24f4ee351f5fbaf988465b6eee`; live pg_get_functiondef MD5 `9e975ab443897fb4ead5bc1dfe5a129e`. PostgreSQL 17.6 compilation and readback PASS: exact 18-argument signature, SECURITY DEFINER with empty search_path, anon/authenticated EXECUTE and no PUBLIC EXECUTE. Direct existing-public-data query returns DSG price_desc IDs 001/002/005 and prices 124900/68900/18900. No listing, identity, payment or private evidence was mutated. Application deployment/browser acceptance follows separately.
