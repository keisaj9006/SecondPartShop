# RC-05 native PostgreSQL 17 release gate — 2026-10-28

## Decision

**RC-05: PASS.** Two independent native Supabase/PostgreSQL 17 replays completed from empty Docker volumes. Replay A's volume was destroyed before Replay B was created. The replays have identical ordered source hashes and identical final catalog fingerprints. The hosted SecondPart project was read only throughout.

**Controlled `review_ready` deployment: GO, but only after a separate explicit hosted-DDL approval.** The SQL is prepared and passed the full native test twice. Blind `db push`, migration repair, and historical ledger edits remain forbidden.

**Commerce B–H provider execution: NO-GO in the shared Preview database without a separately approved isolated provider/data fixture.** The fail-closed harness, reduced-SQL concurrency tests and 220 focused tests pass, but no new Stripe object or shared hosted row was created in this checkpoint. Those are not full provider E2E evidence.

## Source and environment

- Repository base: `origin/rebuild-nextjs` at `2ef017a67dab93fd3b80d3ab51ebc11b224e6ce6`.
- Isolated branch: `codex/rc05-final-hardening`.
- Canonical source additions: RC-03 `ab3c912fe6c749917ddd4ab5e722a49274922a79` and RC-04 `8ad97b5200dfac04e51b0adddb4490b6bd020b38`, cherry-picked without changing `main`.
- Windows 10 build 26200.9711; WSL 3.0.3.0, Linux kernel 6.18.54.1-1.
- Docker Desktop 4.97.0; Docker client/server 29.9.2; Linux/amd64 engine.
- Supabase CLI 2.122.0. Downloaded release ZIP SHA-256: `60031fd5bf050fc12a0c6aef68997600d143870f944bf13109c7765dca329af8`.
- Official database image: `public.ecr.aws/supabase/postgres:17.11.0.006`.
- PostgreSQL server: 17.11; local `psql`: 17.11.
- Node 24.20.0; Microsoft OpenJDK 21.0.12.1.
- Native services after each replay: GoTrue Auth HTTP 200; Storage API HTTP 200.
- Native extensions after each replay: `pg_cron` 1.6.4, `pg_trgm` 1.6, `pgcrypto` 1.3.
- Native Cron after each replay: 4 active jobs.

The clean platform starts with Auth and Storage schemas and extension packages available. The canonical migrations install `pg_trgm` and `pg_cron`; the runner separately enforces package availability before replay and installation plus the native `cron` schema after replay. No Auth, Storage, or Cron shim is used.

## Replay evidence

| Evidence | Replay A | Replay B |
|---|---:|---:|
| Empty public base tables before replay | 0 | 0 |
| Canonical units | 207/207 PASS | 207/207 PASS |
| Application functions | 188 | 188 |
| User triggers | 50 | 50 |
| RLS policies | 135 | 135 |
| client-role table grants | 517 | 517 |
| Cron jobs | 4 | 4 |
| Auth / Storage | 200 / 200 | 200 / 200 |
| `review_ready` native matrix | PASS | PASS |
| Volume after completion | destroyed; 0 containers/0 volumes | destroyed; 0 containers/0 volumes |

Machine evidence:

- [Replay A JSON](2026-10-28-rc05-native-replay-a.json) — SHA-256 `245085b929142e161f99eb4806198b562d885c6b616035a673910d0dd2e0c655`.
- [Replay B JSON](2026-10-28-rc05-native-replay-b.json) — SHA-256 `245085b929142e161f99eb4806198b562d885c6b616035a673910d0dd2e0c655`.

The two JSON evidence files are byte-identical. Explicit comparison returned zero entry differences, zero catalog-fingerprint differences and zero count differences. This proves Replay B did not merely reach a similar count; it executed the same 207 mapped units with the same hashes and produced the same definitions, triggers, policies, grants and Cron jobs.

## Replay ↔ current hosted comparison

Fresh read-only hosted evidence on 2026-10-28:

- project `etkupijfdznljimrfyct`, PostgreSQL 17.6;
- 207 ledger rows; head `20261008130523`;
- exact five-function repair ledger identity present once;
- `20261014202700` / `review_ready_notifications_forward` present zero times;
- 188 functions, 50 triggers, 135 policies, 517 grants, 4 Cron jobs;
- `review_ready` function and trigger both absent.

Exact hosted-comparable fingerprints:

| Catalog | Replay A/B | hosted | Result |
|---|---|---|---|
| triggers | `d6e1fd67c050f8d01641427e2321d3af` | same | exact match |
| policies | `4c400244e4600644b831408a19531cd1` | same | exact match |
| grants | `4250a4da1b8d4b7c2d36da043ac89e97` | same | exact match |
| Cron | `d9dabbf47ea108e74e3da7d71d9f9d77` | same | exact match |

All 188 native replay function-definition MD5s equal the RC-04 canonical replay definition MD5s. The current hosted 188-function inventory fingerprint is `b82b7a4b8b88fda05a7e0f32b3c15612`, exactly the RC-04 hosted inventory fingerprint. Therefore the earlier reviewed comparison still applies to the current host: 164 definitions are byte-normalized MD5 matches and the remaining 24 are ordered SQL-token matches (including the documented redundant output aliases in `seller_import_batch_readiness`). There is no new unexplained critical function drift.

The four duplicate historical source timestamps and the repeated seller-identity name are resolved only by the explicit 207-unit replay manifest. No applied migration was renumbered and no hosted ledger row was changed.

## Native `review_ready` result

Candidate: [20261014202700_review_ready_notifications_forward.sql](../../supabase/migrations/20261014202700_review_ready_notifications_forward.sql).

- LF-normalized SQL SHA-256: `de915d37becb9bbecfcc99edf9c6ca220284c85673bb5c6ff3b6bf3d61f5ab94`.
- The migration is excluded from both baseline replays and applied only by the candidate test.
- Preflight confirmed 0 function / 0 trigger.
- Postflight confirmed 1 function / 1 trigger.
- Trigger: AFTER UPDATE of `payout_status`, `funds_released_at`, `fulfilment_status`.
- Predicate: only `released` + non-null release time + `completed`, on a qualifying transition.
- Recipients: exactly buyer and seller; two distinct profiles.
- Payload: existing `account` type and `/account/reviews`; synthetic part title included.
- Dedupe: repeated release transitions remain at two notifications.
- ACL: anon EXECUTE false; authenticated EXECUTE false.
- Function: SECURITY DEFINER with empty `search_path`.
- Rollback rehearsal: 0 function / 0 trigger / 0 fixture notifications after transaction rollback.
- No backfill exists. Previously eligible historical items intentionally remain without a proactive notification unless a separately designed and approved backfill is created.

The native harness is [rc05-review-ready-native.sql](../../scripts/rc05-review-ready-native.sql). It uses synthetic rows inside a transaction and rolls back all DDL and DML.

## Single forward-only hosted deployment plan

### Identity and mechanism

Use exactly one approved Supabase Management API `apply_migration` operation against project `etkupijfdznljimrfyct`, with name `review_ready_notifications_forward` and the exact LF-normalized SQL above. This mechanism applies one transaction and creates one new migration-ledger record without comparing, renumbering, repairing, or replaying the 207 historical rows. Do not use `supabase db push`, `migration up --include-all`, or `migration repair`.

Because the Management API assigns the ledger version, capture the returned version immediately and rename the repository file to that exact version in the same reviewed release change if it differs from the reserved `20261014202700`. The SQL hash and name must remain unchanged. Abort before application if the API cannot guarantee one migration transaction plus one ledger record.

### Read-only preflight

Run immediately before the separately approved operation and require every predicate to be true:

```sql
select
  current_setting('server_version_num')::int/10000 = 17 as pg17,
  to_regclass('public.order_items') is not null as order_items_present,
  to_regclass('public.notifications') is not null as notifications_present,
  to_regprocedure('private.notify_transaction_review_ready()') is null as function_absent,
  not exists(select 1 from pg_trigger where tgname='transaction_review_ready_notification' and not tgisinternal) as trigger_absent,
  exists(select 1 from pg_indexes where schemaname='public' and tablename='notifications' and indexname='notifications_profile_dedupe_unique') as dedupe_index_present,
  exists(select 1 from supabase_migrations.schema_migrations where version='20261008130523' and name='account_deletion_checkout_fitting_serialization') as repair_present,
  not exists(select 1 from supabase_migrations.schema_migrations where version='20261014202700' or name='review_ready_notifications_forward') as candidate_absent;
```

Also capture a fresh database backup/PITR state, ledger count/head, Preview exact SHA and deployment target. Any false/unknown result is NO-GO.

### Postflight

Require one new ledger row and no other ledger delta; then read only:

```sql
select p.prosecdef,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_exec,
  pg_get_triggerdef(t.oid) trigger_definition
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
join pg_trigger t on t.tgfoid=p.oid and not t.tgisinternal
where n.nspname='private' and p.proname='notify_transaction_review_ready'
  and t.tgname='transaction_review_ready_notification';
```

Expected: one row, `prosecdef=true`, `proconfig={search_path=""}`, both client EXECUTE flags false, exact three-column AFTER UPDATE trigger. Re-run function/trigger/policy/grant fingerprints and verify no unrelated delta.

### Recovery / rollback

The preferred response to a code/payload defect is a second reviewed forward migration. For an urgent trigger incident, the reviewed recovery SQL is:

```sql
begin;
drop trigger if exists transaction_review_ready_notification on public.order_items;
drop function if exists private.notify_transaction_review_ready();
commit;
```

This stops future notifications. It deliberately does not delete notifications already emitted and does not rewrite either migration-ledger row. Deleting notification history would be a separate data-impact decision. Restoring the function later requires another forward migration.

### Preview smoke test

Use only a Preview/test deployment pinned to the reviewed SHA and an explicitly approved synthetic buyer, seller, part, order and item. Verify buyer visibility, seller visibility, no unrelated visibility, duplicate suppression and unchanged review eligibility. Do not use a real order, payment, refund or payout. Remove the synthetic rows with an approved cleanup transaction. The current shared hosted database was not mutated in RC-05.

## Validation performed

- New native-runner unit tests: 6/6 PASS (RED→GREEN observed).
- RC-03/RC-04 focused migration-source tests: 9/9 PASS.
- Native replay A: 207/207 PASS.
- Native replay B: 207/207 PASS.
- Native `review_ready`: PASS twice.
- Focused commerce/concurrency/security tests: 220/220 PASS; no provider mutation.
- Release validators: notifications, launch baseline, monitoring, commerce E2E harness, checkout expiry race, payout recovery, Android RC, account deletion E2E, seller read policy and mobile performance — all PASS.
- lint: PASS with four pre-existing warnings and zero errors.
- typecheck: PASS.
- production build: PASS.
- runtime dependency audit: 0 vulnerabilities.
- full dependency audit: 8 dev/build findings (1 critical, 4 high, 3 moderate), chiefly the known nested `@capacitor/assets` toolchain; no automatic fix is available and no audit fix was applied.
- `git diff --check`: PASS.

## Remaining release blockers

- Supabase Auth leaked-password protection is disabled (fresh security advisor WARN); enabling it is a hosted configuration change and was not authorized here.
- Supabase advisor reports 16 anon and 68 authenticated SECURITY DEFINER executable functions. Critical ACL/search-path invariants pass, and many are intended public/authenticated RPCs, but the complete warning set needs an explicit endpoint-by-endpoint allowlist before public launch; do not revoke blindly.
- 61 unused-index notices are informational on the current low-traffic dataset; production-scale query/load evidence is still required before deleting any index.
- Commerce B–H still lacks fresh provider + UI + database evidence from one isolated run. The 220 passing tests are not represented as full E2E.
- Buyer, seller and admin role journeys still need controlled exact-SHA UAT; destructive account deletion remains unexecuted against a disposable real Auth identity.
- Android automated RC gate passes, but the 44-scenario physical-device matrix and physical FCM/checkout/camera/App Links evidence remain required.
- Public Production, legal, operational alert destination, backup restore rehearsal and marketplace-liquidity gates remain open.

No Production, `main`, Stripe Live, Google Play public track, hosted schema, hosted ledger, hosted order/payment, Storage object or user account was changed.
