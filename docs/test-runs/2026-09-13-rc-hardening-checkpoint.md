# SecondPart RC hardening checkpoint — 2026-09-13

This checkpoint records only evidence actually observed on `rebuild-nextjs`, QA Supabase and Vercel Preview. It does not convert external/manual prerequisites into PASS.

## Current verified application SHA before this evidence-only commit

- `cf761a057cb6d733116e72ae0957758a0ca02bdb` — `support: show account request statuses`
- GitHub Actions run: `34768652933`
- Jobs: `validate` PASS, `last-stock-concurrency` PASS, `marketplace-scale-postgres` PASS
- Unit/integration suite: **466/466 PASS**, 0 failed, 0 skipped
- Lint: 0 errors (3 unchanged legacy warnings)
- Typecheck: PASS
- All release validators in the workflow: PASS
- Next.js production build: PASS
- Exact-SHA Vercel deployment: `dpl_2AzwKfjJpBhPjWnkoQU9aEe2rXwh` — READY

## Public seller data boundary — VERIFIED

The previous table-wide seller read contract exposed private seller columns to direct PostgREST reads even when UI did not need them.

Implemented and verified:

- QA migration `20260913161409 / public_seller_data_boundary`
- table-level `SELECT` removed from `anon` and ordinary `authenticated` on `public.sellers`
- public column whitelist retained for seller marketplace identity
- `postcode`, `latitude`, `longitude`, postcode-geocode fields and deletion marker are not client-readable through the normal seller table grant
- authenticated owner-only `get_own_seller_profile_private()` RPC added with `SECURITY DEFINER`, empty `search_path` and ownership derived only from `auth.uid()`
- public seller profile no longer renders full postcode
- public listing projections do not request postcode
- public mobile listing responses pass through a defensive serializer that forces seller postcode to `null`
- seller-owned web/mobile settings retain postcode access; server-side distance search retains service-side geo access

QA readback after migration:

- `anon` table-level seller SELECT: false
- `authenticated` table-level seller SELECT: false
- public `business_name` column SELECT: true for expected public roles
- `postcode` SELECT: false for anon/authenticated
- `latitude` SELECT: false for authenticated
- owner RPC: anon execute false; authenticated execute true; service role execute true

Runtime Preview proof on the exact support SHA:

- public mobile listing detail returned HTTP 200
- seller `postcode` was serialized as `null`
- no seller latitude/longitude/geocoding fields were present
- general seller `location` remained public

This gate is CLOSED for the observed public seller postcode/geo boundary.

## Support intake status visibility — VERIFIED; mailbox delivery remains EXTERNAL

Implemented without adding a new helpdesk subsystem:

- signed-in user sees up to 10 most recent own `support_requests`
- safe projection only: id, topic, message, status, created/updated timestamps
- loader is owner-scoped by `profile_id`
- status labels: `Submitted`, `In review`, `Closed`
- new submissions revalidate `/contact`
- history load failure does not block a new support submission
- UI explicitly states that status is triage and does not promise an in-app reply

Focused support tests are included in the 466/466 successful suite.

Runtime anonymous `/contact` on exact-SHA Preview returned HTTP 200 and retained Preview `noindex` behavior.

**Still EXTERNAL:** Preview currently has no configured public support email. A real monitored mailbox, operational ownership and real response receipt are not PASS.

## Native PostgreSQL 17 marketplace scale — VERIFIED in isolation

The dedicated `marketplace-scale-postgres` job runs an isolated PostgreSQL 17 service with 25,000 synthetic listings and the exact current search migration.

Observed final native PG17 proof:

- all six scale/correctness scenarios PASS
- deep-page ordering/pagination and search eligibility retained
- isolated individual queries observed roughly 66–261 ms in CI
- the full verifier completes separately from shared Supabase QA

This proves the current search SQL on native PostgreSQL 17 at 25k synthetic scale. It **does not** prove hosted network latency, CDN/image delivery or concurrent production load.

## True last-stock concurrency — VERIFIED

Dedicated two-connection PostgreSQL 17 job remains GREEN on current runs. The overlapping transaction proof confirms one winner for stock=1 and no duplicate order/item/reservation event creation.

## Previously hardened P0/P1 code paths retained GREEN

The current full suite/validators retain regression coverage for:

- provider cancellation/session authority and terminal pre-attach race
- paid vs delayed terminal webhook ordering
- refund state authority and retry correlation
- provider dispute event ordering and replay safety
- Received / Accept / 48-hour idempotency and case blockers
- role/RLS negative paths
- account-deletion minimization function behavior
- vehicle lookup limiter fail-closed behavior
- Find My Part buyer response delivery
- CSV lookup privacy-safe diagnostics
- checkout/payout retry/idempotency guards

These code/DB proofs do not replace the provider/device evidence listed below.

## QA fixture/readiness observations

Safe aggregate readback at this checkpoint:

- buyer profiles: 1
- active non-deleted sellers: 5
- payout-ready sellers: 1
- active in-stock parts: 6
- orders: 2
- paid orders: 1
- transaction case-evidence rows: 0
- `case-evidence` Storage objects: 0
- account-deletion requests: 0

Commerce fixtures therefore exist, but provider adverse-flow execution still requires the authorized test-mode admin/provider session. There is no existing case-evidence object or disposable deletion request to use for a live object/deletion E2E.

## Remaining release gates — NOT PASS

### P0 / external or manual

- real Stripe test-mode adverse flows: decline→retry, refund/reversal/dispute provider execution and webhook delivery/replay
- provider operation evidence requires an authorized test-mode admin/provider session; LIVE mode remains prohibited
- physical Android signed build/device: FCM receipt, deep links/external return, camera/upload and device-specific behavior
- real mailbox/support response delivery and operational ownership
- real critical alert delivery; Preview has no `OPS_ALERT_WEBHOOK_URL`
- live `case-evidence` participant-versus-outsider Storage read; QA currently has zero evidence objects
- destructive account-deletion E2E using a deliberately disposable QA identity; existing QA accounts must not be deleted
- actual seller CSV partial import through authenticated seller server action/PostgREST; existing synthetic recovery tests are strong but are not relabelled as live E2E
- legal identity/wording/retention/support sign-off where human/legal ownership is required

### P1 / external or environment-dependent

- hosted 25k latency under real network/CDN/image conditions and concurrent load
- approved production domain/canonical/sitemap deployment
- native zoom/screen-reader manual verification on critical journeys
- stable operational alias management where the manual Preview alias is not the current branch source of truth

### External product/network prerequisites

- DVSA approval/integration; manual vehicle selection remains the valid fallback
- real seller inventory/liquidity and operational supply targets

## Release interpretation

Green CI is necessary but not sufficient for closed beta/public launch. The code/DB defects above are materially hardened, but the unresolved P0 provider/device/mailbox/destructive-fixture gates must remain visible. Do not infer real-money, physical-device, operational-support or production-load readiness from this checkpoint.
