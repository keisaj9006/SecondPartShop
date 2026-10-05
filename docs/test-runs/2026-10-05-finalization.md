# Finalization execution ledger — 5 October 2026

This is the running evidence report requested by the owner, not a replacement release checklist. Canonical gates remain [launch readiness](../launch-readiness.md), [SecondPart 1.0](../SECOND_PART_1_0_CHECKLIST.md) and the commerce/Android runbooks. No release sign-off is inferred from reading code.

## Baselines and rulings

- Starting canonical `rebuild-nextjs`: `1d4fd279684ee8faf15fee23d9818efdc85382b0`; dependency repair merged as `d90c6122a5697fd84c6b2569984cfb2c10630f25`.
- DVSA PR [#10](https://github.com/keisaj9006/SecondPartShop/pull/10): code `8956e1b81d857abbf7b278455262a31e9d6e5643`, still open; no merge until real provider and Garage gates pass.
- Original dirty checkout is preserved. Work occurs in isolated feature worktrees. No main/Production/Stripe Live changes.
- Ruling: repair a concrete vulnerable production dependency in a separate feature PR while awaiting the DVSA fixture. This does not waive the requested DVSA merge gate or claim that the post-DVSA canonical audit has completed.

## DVSA activation and integration

Official Vercel CLI renewed the existing session; REST metadata confirms all five canonical names are configured only in Preview. The new deployment's environment-name list includes all five, with no public DVSA name. No decrypted value was pulled into a file or printed.

New **5 October** deployment `dpl_DjMVuEkkuNKu97iCYrCYoovnUWdP`, Preview (`target=null`), branch `codex/dvsa-integration`, exact code SHA above, READY:
https://second-part-shop-krwydzwsg-joannakwapis11-5369.vercel.app

Home and Garage entry HTTP 200; `/api/mobile/v1/health` 200 with `backendReady=true`. Invalid registration HTTP 400 and actual UI feedback verified. `agent-browser` supplies working runtime browser automation despite the separate CUA helper startup failure.

Controlled public UI measurements: no horizontal overflow at 320/390/768/1440 px. Fresh Add vehicle clears registration/catalogue selection and shows the explicit compatibility choice. Manual chooser is reachable. This is not a full authenticated mobile/device matrix or DVSA → Garage persistence proof.

Designated QA accounts have **zero** saved Garage registrations (read-only aggregate). The owner was asked for one legitimate UK registration. No fake valid-looking registration was submitted to DVSA. Live OAuth, live vehicle response, provider not-found and authenticated Garage journey remain pending that fixture and authenticated QA setup. Mock token reuse is not relabelled as live token reuse.

[DVSA evidence](2026-10-01-dvsa-integration.md) and [operations note](../dvsa-operations.md) retain exact boundaries.

## Automated evidence

- DVSA focused suite: **44 passed**, zero failed.
- Exact DVSA code [QA run 37302662382](https://github.com/keisaj9006/SecondPartShop/actions/runs/37302662382): all five jobs succeeded, including full validation, true last-stock concurrency, dispute-reversal concurrency, evidence concurrency and isolated PostgreSQL scale proof. Full suite has **717** tests.
- [Android dry-run 37302667530](https://github.com/keisaj9006/SecondPartShop/actions/runs/37302667530): successful. CI signer/Firebase fixtures are not production credentials or a Play-ready release.
- Separate dependency repair: **694** canonical-baseline tests passed, lint zero errors/four previous warnings; patched build passed. Its own remaining checks/integration are recorded in [dependency evidence](2026-10-05-next-security.md) on that feature branch.

## Concrete security finding and repair

Production audit found critical Next.js advisory GHSA-vcvr-r3jv-pc5j in 16.3.4. No use of its vulnerable Node ImageResponse entry point was found in the application; exploitation was not demonstrated. P1 runtime-dependency repair: exact Next/eslint patch pins to 16.3.8 plus a high/critical production-audit CI gate on separate `codex/next-security-2026-10-05`. Production audit after patch: zero vulnerabilities. Full development audit retains six transitive DoS entries; no unsafe major downgrade/force fix was applied. Independent reviewer found no actionable dependency/lock/gate issue.

[PR #11](https://github.com/keisaj9006/SecondPartShop/pull/11) merged only into rebuild-nextjs as `d90c6122a5697fd84c6b2569984cfb2c10630f25`. Repair application SHA `9d62d3518715f5aed11611201f6cf3febe8f43d4` passed [all five QA jobs](https://github.com/keisaj9006/SecondPartShop/actions/runs/37304582643), including the new production audit, and [Android dry-run](https://github.com/keisaj9006/SecondPartShop/actions/runs/37304587428). Exact Preview `dpl_AnppSLpsXw53fPVjeu94WCjj5NLx`, https://second-part-shop-gcjl0n3z5-joannakwapis11-5369.vercel.app, READY/Preview/correct branch+SHA, passed Home/health/Privacy/Account Deletion HTTP checks. Real browser denied anonymous admin entry and redirected to Account/sign-in. HTTP 200 from a streamed Next.js redirect alone was not treated as permission to read admin data.

## Supabase/RLS checkpoint

Read-only hosted PostgreSQL 17 metadata confirms RLS enabled on Garage, parts, orders/items and lookup cache/limiter. Garage SELECT/INSERT/UPDATE/DELETE policies enforce `auth.uid() = profile_id`, including update WITH CHECK. No policy or privilege was weakened.

Advisor categories: 11 informational no-policy tables, 16 anonymous SECURITY DEFINER warnings, 68 authenticated warnings and disabled leaked-password protection. This is not a clean full security audit; intended RPC/public boundaries require their existing contracts and subsequent adversarial runtime checks. The leaked-password gate remains an external plan/configuration issue per existing runbook.

Direct privilege readback for all 11 no-policy tables confirms neither anon nor authenticated has SELECT/INSERT/UPDATE/DELETE privileges. Preserve this deny-all boundary; do not add broad policies to silence the informational advisor.

Migration history includes the 21 September dispute-reversal recovery and case-evidence cleanup outbox/registration guard, superseding the older generic claim that the latter is undeployed. No migration was applied by this run.

## Stripe, performance, Android and operations

- No Stripe operation was performed during this checkpoint. Existing scenario evidence remains retained. Provider dispute lifecycle, declined → retry → success and full UI last-stock race are not re-labelled verified by SQL CI concurrency alone.
- Fresh QA exercised the existing isolated PostgreSQL scale harness; no synthetic inventory was inserted into hosted/Production data. It is database proof, not physical-device navigation proof.
- GitHub secret-name readback has only `ANDROID_PREVIEW_KEYSTORE_BASE64`; production upload signing, Play fingerprints and production Firebase remain external. No real production AAB/Play upload/device result is claimed.
- Health is freshly verified. Alert destination, natural Auth email lifecycle, destructive account deletion and signed physical FCM still require their normal runtime evidence.

## Current gate ledger

| Gate | Status/severity | Evidence/action | Owner | Codex can execute now |
|---|---|---|---|---|
| New DVSA Preview and environment names | VERIFIED scoped activation | New deployment above; no provider success claim | Codex | Completed |
| DVSA live integration | VERIFIED scoped provider lookup | Authorized real lookup HTTP 200; hashed cache and browser correlation below | Codex | Completed |
| DVSA → authenticated Garage | P1, not verified | Natural authenticated persistence/reload/switch tests and known derivative still required; automated ownership tests pass | Owner → Codex | Owner session/derivative prerequisite |
| PR #10 merge | P1 gate held | Only after live/regression evidence; remains open | Codex | Not yet authorised by the conditional gate |
| Vulnerable production Next dependency | VERIFIED scoped P1 repair | #11 merged after audit GREEN, local/CI/Preview/Android gates | Codex | Completed |
| Development-only glob advisories | P2 | Trusted build patterns; upstream remediation, no forced major downgrade | Codex/upstream | No safe full fix assumed |
| Provider adverse transaction scenarios | P1, unsigned | Existing commerce runbook; Sandbox + application + DB evidence needed | Codex | Post-DVSA sequence, truthful QA fixtures |
| Full Auth/deletion lifecycle | P1, unsigned | Existing natural-email/provider flow; no forced confirmation/deletion shortcut | Codex/provider | Post-DVSA sequence/prerequisites |
| Production signing/Firebase/domain/Play | EXTERNAL | Missing configuration/identity decisions; no Production authorisation | Owner | No |
| Physical Android/FCM/Play test matrix | MANUAL | Actual connected device/test-track observations required | Owner/Codex | Device-dependent |
| Legal/support/liquidity | EXTERNAL | Canonical legal/marketplace gates remain open | Owner | Technical preparation only |
| Post-DVSA full canonical audit and counts | P1, not yet completed | Requested phase 7 begins after safe #10 merge; do not invent P0/P1 totals | Codex | After the explicit sequence gate |

## Release decision at this checkpoint

Internal controlled technical testing can continue in Preview. Closed beta/public launch are **not signed off**. Android's CI AAB path works, but the production artifact is not ready for Play submission without real signing/Firebase/domain/Play configuration and physical evidence. Public marketing remains gated by the canonical provider, legal and liquidity requirements.

No defensible complete release-gate denominator or total P0/P1 count exists until the requested post-DVSA audit is executed. Continue automatically through the DVSA gate and subsequent phases when the prerequisites below are available.

## Authorized live DVSA checkpoint — 5 October, 12:13 UTC

The owner supplied one legitimate registration and authorized its controlled lookup. The registration itself is deliberately omitted from this committed report.

- Exact deployed application head: `98e8d85c59f94f29e98997ff1aaf41ca4e446e6f`, branch `codex/dvsa-integration`, Preview/READY, deployment `dpl_AunC6aWjABBLWJzTMurdD813MRJG`.
- Preview: https://second-part-shop-iwp7fz30z-joannakwapis11-5369.vercel.app.
- All five canonical DVSA environment-variable names were confirmed from deployment metadata; no values were retrieved.
- One authorized API request using lowercase/spaced input returned HTTP 200 and normalized registration. Safe vehicle projection: Vauxhall Astra, petrol, 1399 cc, white, first-used year 2017. `strategy=dvsa_to_dft`, `engineMatched=false`, `resolution=choose_variant`.
- Read-only cache correlation found the hashed lookup with provider `dvsa_mot_history`, status `found`, fetched at `2026-10-05 12:13:13.389+00`, expiry one day later. No cache row was manually inserted or invalidated. This is real provider success evidence through the OAuth-protected application path; raw OAuth credentials/tokens and provider bodies were not inspected or recorded.
- The browser returned the same vehicle and explicit exact-version chooser. No derivative was guessed. Use this vehicle remains disabled until sufficient catalogue selection is supplied. This does not prove compatibility with any listing.
- Search again cleared registration, lookup result and manual catalogue context; inspected input was empty. Fresh Add vehicle also started empty.
- Malformed punctuation input returned controlled HTTP 400. Unknown/404, OAuth failure, 429, 5xx and malformed upstream handling were exercised by existing deterministic tests, not induced against the live provider. No fabricated registration was submitted to DVSA. Real timeout injection and live unknown-registration evidence are not claimed.
- All 44 focused DVSA/Garage/guidance/filter/rate-limit tests passed again, zero failures. QA run `37305244492` passed all five jobs (717 tests); Android run `37305248731` succeeded on the tested application head.
- Ten JavaScript chunks referenced by the public Home page were scanned: zero matches for canonical DVSA credential names, `client_credentials` or `access_token`. Safe response projection and browser text were inspected. This marker scan is not a value-by-value secret scan or a complete audit of runtime logs; those broader claims remain unsigned.

The live DVSA fixture blocker is now closed. **Authenticated Garage persistence and the exact known derivative remain unverified.** The shared-browser tool failed with a kernel error; the independent automated browser has no owner session. No password, authentication token or manual database/auth bypass was requested or used. Owner action: sign in normally on this Preview, select only the vehicle's known derivative if required, save through Garage, reload and confirm persistence. PR #10 remains open until the complete conditional gate passes.

Current Google Play policy was rechecked against official sources on 5 October: new submissions require API 36, already enforced by `patch-android-production.mjs` and both Android CI workflows. Current page-size guidance still requires 16 KB support for applicable 64-bit/native code; exact submitted-artifact and device checks remain mandatory. This checkpoint did not build a Production artifact or publish anything.

Sources: https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-EN and https://developer.android.com/guide/practices/page-sizes.
