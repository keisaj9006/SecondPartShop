# Marketplace search SQL integration fixture

`test-marketplace-search-sql.mjs` runs one in-memory PGlite 0.5.8 engine, PostgreSQL 18.3 / pg_trgm 1.6, with serial transaction-rollback scenarios. Preview uses PostgreSQL 17.6. This is a real SQL function integration test on a reduced schema, **not** a Supabase migration replay or production performance benchmark.

The explicit dependency manifest is executable in `scripts/lib/marketplace-search-sql-harness.mjs`. It loads complete named table/function declarations with exact-occurrence assertions from the base marketplace, catalogue variants/fitments, donor vehicles, reputation, transaction cases and verified-feedback migrations. The fixture SQL adds the consumed later columns with their PostgreSQL types. It loads the actual warranty/delivery migrations and actual fulfilment/payment/payout/case checks. It uses genuine `private.is_admin()` and `private.owns_seller()` definitions, actual parts SELECT policies, actual seller policy consolidation, and actual feedback SELECT policy/grants.

Function/view migration order after bootstrap:

1. Legacy compatibility from `20260905115729`; full synonym migration `20260905121247`; current detail compatibility from `20260906263000` (not its earlier pre-feedback definition).
2. Full catalogue sorted-page `20260907125000` and indexed search `20260907130500`, including generated FTS and GIN/trigram indexes.
3. Both complete canonical corrections `20260907163500` and `20260907165000`. Their real security-barrier views retain paid/completed/released/no-refund/no-blocking-case conditions. The unrelated public-review RPC patch loop has no targets in this schema; those RPCs are not validated here.
4. Full current candidate-search `20260909100500`, catalogue cursor `20260909202000`, distance V2 `20260909203500`, seller policy `20260911090000`, and FIT-01 `20260911211956`. FIT-01 sees exactly its two real target functions; no fake function is installed to satisfy its guard.
5. The new `20260912110440_complete_marketplace_search_page.sql` migration unchanged, including grants, security, volatility and empty search path. Old capped search stays installed for the baseline comparison.

The unavailable Auth boundary is represented by `auth.users(id)` and a test-only `auth.uid()` reading a transaction-local claim. Anonymous/authenticated roles are NOLOGIN/NOSUPERUSER/NOBYPASSRLS, and public-output assertions execute under those roles, including an authenticated admin who can directly read deleted sellers. No client gets the private evidence views. No Auth lifecycle, Storage, payment mutation triggers, provider functions, checkout, independent-session concurrency, PostgREST serialization or JWT middleware is simulated as passing.

Fixtures use deterministic UUIDs and timestamps. Table resets roll back; engines close even after failure. Tests do not read env files or network credentials. Matching/order expectations derive from explicit fixture facts, not an implementation-shaped JavaScript search engine. Historical source caps are reproduced with 1,601 source-equivalent rows before applying the forward migration.

The harness verifies SQL parsing/execution, typed smallint/UUID-array/null parameters, DO/PLpgSQL/`pg_get_functiondef`, stored FTS and GIN/trigram support, role switching, RLS/grants, complete filtering/global sorts/pagination, literal-before-synonym semantics and canonical fit evidence. It does not reproduce every production index or planner statistic. No WASM timing is a latency target; representative 100k PostgreSQL query plans, network payload measurements, deployment checks and browser grouping acceptance remain separate controller gates.
