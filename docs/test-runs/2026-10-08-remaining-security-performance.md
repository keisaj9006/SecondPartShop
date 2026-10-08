# Remaining security and performance independent pass — 2026-10-08

Reviewed baseline: `codex/final-rc-hardening`, `8ed1fc002c03af6f8865e23d754437f7a2c93d9e`, plus the narrowly scoped saved-search read-side repair described below. This is scoped engineering evidence, not whole-product security certification or launch approval. No new P0/P1 was reproduced; previously verified RC26-06/08 closures stand.

## Fresh hosted read-only security inspection

Supabase project `etkupijfdznljimrfyct`, observations around 17:07 UTC. Only catalog/policy/function-definition SELECTs and advisory reads were performed. No hosted mutation, DDL, account deletion, Storage operation, fixture cleanup or worker was invoked.

- All **58 public base tables** have RLS enabled; there are **zero public views/materialized views**. RLS enabled does not mean every policy is automatically correct.
- Catalog inspection covered **142 public/storage policies**. No authenticated mutation policy had an unconditional `true` USING/WITH CHECK expression. No inspected policy expression used user-editable `user_metadata` as authority. Ownership/participant/admin predicates remain on Garage, saved data, orders/items, cases/evidence and support.
- There are **107 public SECURITY DEFINER functions**, with **106 empty search paths**, **16 executable by anon**, and **68 executable by authenticated**. These overlapping execution counts are not defect counts. Public anon functions listed by the advisor are public search/catalogue/profile/reputation reads, not the tested privileged mutation families.
- The sole public nonempty search path is `import_vehicle_catalogue_batch`: `search_path=public`, ACL only postgres/service_role, anon/authenticated EXECUTE false. Neither anon nor authenticated has CREATE on public. Its table/type references are qualified. This is a possible future consistency cleanup, not a reproduced public privilege escalation.
- Fresh definitions of `private.is_admin`, `can_read_order`, `can_read_order_item`, and case-evidence object read/upload guards were inspected. Admin authority comes from the current profiles row, not user metadata. Order/item checks require matching buyer, seller owner or admin; NULL participant comparisons do not grant authority. Upload evidence additionally binds the actor path and an open case. All inspected private helpers have empty search paths and authenticated-only public-client execution.
- Storage restrictions were checked with permissive/restrictive metadata: the part-images UPDATE/DELETE exclusions are **RESTRICTIVE**, not stand-alone grants to mutate other buckets. Case evidence read/upload remains participant-guarded.

Fresh advisory counts:

| Notice | Count | Disposition |
| --- | ---: | --- |
| RLS enabled with no policy | 11 INFO | Internal/service tables deny ordinary client access; no blanket policy added |
| Anonymous SECURITY DEFINER execution | 16 WARN | Intentional public read surface requires continued scoped review |
| Authenticated SECURITY DEFINER execution | 68 WARN | Explicit authorization matters; no blanket revocation or RLS weakening |
| Leaked-password protection disabled | 1 WARN | Existing provider/owner configuration gate remains |
| Unused indexes | 63 INFO | Workload statistics alone do not justify removing indexes |

Advisor references: [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [anonymous definer execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated definer execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Application and isolation review

`src/lib/auth.ts` verifies users with Auth `getUser`, distinguishes stale/malformed-cookie errors from a genuinely anonymous request, reads profile state independently, and denies seller/admin access when profile lookup fails or is missing. `src/lib/mobile-api.ts` validates the bearer token with `getUser` before creating a user-scoped client; seller checks require both the current profile role and matching owner row. No claim of instantaneous revocation of every previously issued JWT follows from these checks; normal external logout/recovery/email lifecycle remains separate.

A focused independent run passed **65/65 tests**, zero skipped/failed. This mixed behavioral/source-contract set covers admin boundaries, real SSR auth-cookie semantics, stale-cookie and forged-marker rejection, profile-error isolation, saved-viewer separation, support ownership, case-evidence signed-URL failure isolation, monitoring redaction, security headers, marketplace/native navigation and scale-harness contracts. Source-contract checks are not hosted cross-user transactions. The prior 32 hosted rollback scenarios and 67 exact-body PG17 tests supply the already verified authorization/concurrency/idempotency evidence; they were inspected earlier and not needlessly rerun against shared state.

Exact focused command:

```text
node --test scripts/test-admin-authorization-boundary.mjs scripts/test-auth-profile-state.mjs scripts/test-saved-viewer-state.mjs scripts/test-support-conversation-security.mjs scripts/test-support-conversation-route-auth.mjs scripts/test-case-evidence-signed-url-fail-closed.mjs scripts/test-monitoring-redaction.mjs scripts/test-security-headers.mjs scripts/test-marketplace-navigation.mjs scripts/test-mobile-navigation.mjs scripts/test-marketplace-scale-harness.mjs scripts/test-postgres17-marketplace-scale-contract.mjs
```

A bounded format scan inspected **591 source/config/public files** and **52 currently built client JavaScript chunks**. Only explicitly synthetic redaction-test credential/JWT literals matched the source patterns. No built client chunk contained service-role, Firebase private-key, Stripe secret-key or private-key markers. No credential values were printed. This is a format/marker scan of the stated paths, not exhaustive secret discovery or a freshly rebuilt artifact attestation.

## Saved-search repair independent review

Root reproduced the read-side loss of `fit=0/1` in `src/lib/data/buyer-account.ts`; the save action already retained it. The minimal repair adds `fit` to the existing read allowlist, preserving type/length bounds and unrelated-key rejection. Two new tests traverse actual save action, database-read mapping and Run-search URL construction for both values. Independently rerun `node --test scripts/test-final-rc-saved-search.mjs`: **5/5 PASS**. No actionable issue found in this minimal change. This new evidence concerns the read-side gap and does not reopen the separately closed deletion/authorization defects.

## Performance evidence and limits

`node scripts/validate-mobile-performance.mjs` passed **66 static invariants**. It includes historical shell checks alongside current hosted-Next navigation, loading boundaries, request deduplication, bounded cards and cursor contracts; this is not 66 measured user journeys. The navigation tests additionally verify pending-state cancellation, committed-path timing, native link prefetch behavior and viewer-scoped vehicle persistence.

The existing isolated scale JSON was checked against current source: all three recorded runs load the same unchanged search migration SHA256 `535194ac597564e1bc005c70f95d01b5824d23d5f466366c41bcd56c8d570911`. Recorded six-query ranges remain 118.9–223.2 ms for 1,000 rows, 103.9–360.4 ms for 10,000, and 162.8–701.4 ms for 25,000, on PGlite/PostgreSQL 18.3. Current migration equality and passing scale-harness contracts provide continuity; these are preserved measurements, not a new benchmark. The separate earlier 100,000-row native PG17 CI evidence remains valid within its documented scope. No large synthetic hosted workload was created.

Fresh bounded cookie-free GET probes used exact Preview `https://second-part-shop-2yba37f23-joannakwapis11-5369.vercel.app` (8ed1fc0), sequentially twice per route, without following redirects or sending credentials. All **10 responses were HTTP 200**, all reported Vercel MISS. Times include this client's network path and streamed response transfer.

| Route | Header time, two samples (ms) | Complete body, two samples (ms) | Bytes |
| --- | --- | --- | ---: |
| `/` | 623 / 272 | 1832 / 1149 | 199173 |
| `/?q=alternator` | 290 / 326 | 662 / 1350 | 165392 |
| `/garage` | 278 / 353 | 284 / 355 | 21775 |
| `/account` | 297 / 611 | 300 / 716 | 83201 |
| `/api/mobile/v1/health` | 1094 / 261 | 1202 / 262 | 83 |

No failure or unbounded response appeared in this sample. Ten samples are not percentiles, a load test, browser INP/LCP, physical WebView latency or a production SLO. The first sandboxed network attempt failed before obtaining a response; the authorized read-only network run produced the measurements above. A future deployment containing the saved-search repair requires the lead's normal exact-head regression/Preview checks.

## Remaining boundaries

No new actionable P0/P1 security/performance defect was found in this pass. Keep disabled leaked-password protection, genuine external mailbox/session lifecycle, normal Auth/Storage deletion, provider interactions and physical-device performance as explicit gates. Continue monitoring real query plans and representative traffic before changing indexes. No merge, Production deployment or launch readiness is approved by this report.

## Final independent affected-change review

Reviewed the current native completion router, webhook handler and their actual-handler/component tests, including the real `closeProviderPaymentDispute` and reconciliation helper return contracts. No additional blocker was found within these changes.

- Native dot-segment P2: `.` and `..` order query values now select `/account/orders` before navigation, preventing URL path normalization from choosing a parent route. Both warm and cold launches, custom scheme and exact same-origin HTTPS completion paths are exercised. Existing foreign-origin/callback/lookalike rejection and server-authoritative refresh remain intact. This is local component execution, not physical Android app-link evidence.
- Webhook dispatch: the flag starts false and becomes true only after successful linked paid confirmation, authoritative cancellation `true`, reconciliation `paid`/`expired`, a non-null opened dispute case, or successful dispute close. The actual close helper throws on missing linkage or absent durable acknowledgement; reconciliation returns deferred for refused expiry and never grants dispatch to missing/skipped/session-mismatch/deferred/already-settled states. Errors return before scheduling. The 26 adapter-based handler tests check these branches without invoking a worker or provider. This prevents ignored events from scheduling global push work; it does not turn the existing legitimate-event dispatcher into an event-scoped queue.
- RC26-09 case-list P1: the restricted retained-part projection follows the caller-scoped query and explicit buyer relationship check. Only authorized current-page missing IDs are used; sentinel and caller-supplied IDs are excluded, duplicates coalesced, and unavailable identity produces explicit 503. Root separately reviewed this subagent-authored repair; this paragraph is a scope/evidence record, not a second independent self-approval.

Fresh independent command: `node --test scripts/test-native-app-mode.mjs scripts/test-stripe-webhook-push-isolation.mjs scripts/test-mobile-buyer-cases.mjs scripts/test-remaining-product-journeys.mjs` — **95/95 PASS**, zero failures/skips, exit 0. Counts: 13 native, 26 webhook, 13 cases, 43 product. Product mapping and adapter/persistence boundaries are recorded in `2026-10-08-remaining-product-automation.md`. Final integrated CI/build/typecheck remain root-owned; no launch-ready claim follows from this review.
