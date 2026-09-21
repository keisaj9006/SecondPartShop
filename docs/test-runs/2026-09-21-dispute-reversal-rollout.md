# Dispute reversal integration and hosted rollout — 21 September 2026

## Integration

- PR: https://github.com/keisaj9006/SecondPartShop/pull/1 (merged into rebuild-nextjs).
- Reviewed patch: f5b859bccd5b3ef6f5bc8dd85c02c6a623b220cd.
- Merge: 26b84b2bc26aa171b414c7ab34c32587cf06e5b1.
- Feature CI: https://github.com/keisaj9006/SecondPartShop/actions/runs/35578633629 — all four jobs PASS.
- Merge CI: https://github.com/keisaj9006/SecondPartShop/actions/runs/35578908945 — PASS.
- New Preview: dpl_DLJopwniSgNN8LA36FdDukkaCGGX, READY.
- main was not changed or deployed. The unrelated dirty original checkout was preserved.

## Controlled window

Inspected hosted migration history and actual open/close function definitions. No existing provider disputes or releasing payouts were present. The connected provider account is SecondPart sandbox, acct_1UEUN72RWsyIBCbK, livemode=false.

The existing endpoint we_1UEa0q2RWsyIBCbKwy45jivt was kept enabled with its event list and signing configuration unchanged. Its URL temporarily points to /api/stripe/webhook/rollout-paused (verified POST 404), so deliveries are not falsely acknowledged. The drain clock started conservatively at 08:37:44 UTC. Old deployment dpl_Gw4x5dhd8vkAw2yrgytbocPFohi4 has config.functionTimeout=300 seconds, verified from Vercel. Activation waits beyond this period.

## Hosted result

- Applied after the 300-second drain, at 08:43 UTC. Hosted migration version: 20260921084303, name provider_dispute_reversal_recovery. Repository CLI-generated version: 20260921075633. Preserve this explicit mapping; do not replay or repair historical versions merely to match timestamps.
- RLS enabled. SELECT/INSERT/UPDATE/DELETE denied directly to anon, authenticated and service_role on private.provider_dispute_reversals.
- All four dispute RPCs have empty search paths and SECURITY DEFINER; EXECUTE denied to anon/authenticated and allowed to service_role. The new claim, terminal-conflict and releasing-payout guards were read back from deployed definitions.
- Actual anonymous REST calls to both new RPCs returned HTTP 401 / SQLSTATE 42501 (permission denied). No claims were created.
- Alias https://second-part-shop-preview.vercel.app now points to dpl_DLJopwniSgNN8LA36FdDukkaCGGX, merge commit 26b84b2. Home GET returned 200; unsigned webhook POST returned 400 with received=false.
- Stripe endpoint original URL restored and confirmed enabled by 08:44:31 UTC. Same endpoint ID, version and enabled events retained.
- The cleanup-outbox migration is unrelated and remains unapplied; this rollout did not batch-push other pending migrations.

Security Advisor: the private evidence table produces the expected informational RLS-with-no-policy notice because all access is through service-only functions. Broader existing API-function warnings and disabled leaked-password protection remain outside this patch; no claim of a globally clean security audit is made. See [RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Remaining provider gate

Fresh signed Stripe dispute delivery, lost-response recovery and replay against a disposable real QA purchase remain UNVERIFIED. No fake paid/refunded state, provider IDs, user roles or authentication bypass was introduced to manufacture a pass. Resume with the existing QA administrator session, verify the runtime preflight, then execute the normal sandbox purchase/fulfilment/dispute scenario. The only connected Stripe account is explicitly test mode, but this alone does not replace the runtime preflight.


## Test access

The browser has an existing QA seller session. The commerce preflight requires an administrator; the page returned admin-required. Requested user sign-in to the existing QA administrator without asking for a password in chat. Vercel sensitive values cannot be exported, so no new credentials or authorization bypass were created.
