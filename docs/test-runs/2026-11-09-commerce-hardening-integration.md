# Commerce hardening integration — 9 November 2026

Base: `origin/rebuild-nextjs` at `2ef017a67dab93fd3b80d3ab51ebc11b224e6ce6`.

This isolated branch extracts only the application fixes from Commerce checkpoint `34f22a235792eed238cfed0c8ab24cbd2450792e`. It does not include RC-05/history changes, `review_ready`, the dev tunnel configuration, fixtures, credentials or the provider test harness.

## Implemented

- Preserve participant-readable case list entries when public part RLS hides a sold listing. The session-scoped case query stays authoritative; only its returned part IDs hydrate the bounded `id,title,slug` projection through the server-only client. No RLS policy changes.
- Resolve the Next.js mobile listings dynamic-directory collision by moving the question route under `[slug]`; preserve the question endpoint's UUID parameter and authentication/RPC behaviour. Update its notification validator path.
- Extend focused regression coverage to seller scoping, empty results without privileged hydration, explicit backend failures, UUID validation, denied anonymous questions and linked conversation dispatch.
- Add the next Internal Testing physical-device checklist, cross-linked to the full RC matrix. No physical test is claimed as completed.

## Verification evidence

- RED on the clean base: sold-listing case test returned zero cases; expected moved question route was absent.
- GREEN after the extracted fixes: focused suite 8/8.
- Independent read-only review: no actionable findings; 8/8 independently repeated, RLS/callers/pagination inspected.
- Typecheck PASS; notification, Commerce E2E, expiry race, payout recovery and seller-read-policy validators PASS. Lint PASS with four pre-existing unused-variable warnings.
- Full local suite: 1310/1310 PASS, zero skipped/failed. This includes three separately prepared security ACL fixture tests not included in this Commerce PR; the Commerce tree contains 1307 tests. Initial full run was 1306/1307 because an existing detail-page test adapter rejected the newly imported admin module. Updating that adapter preserves a throwing admin factory and additionally checks genuine missing purchases; affected detail/Commerce tests then passed 14/14 before the successful full rerun.
- Production build PASS, including the normalized dynamic route. Final targeted ESLint and `git diff --check` PASS. No test is described as physical-device or provider E2E.

These are code and adapter/contract regressions, not a new provider or hosted RLS E2E. Prior B,C,D,E,G,H evidence remains accepted; F remains BLOCKED by the separate local Docker execution issue. The untouched detail/creation lookup and deleted-seller retention paths are not newly signed off by this case-list repair.

## Integration boundaries

PR #28 remains a separate Draft on `9b69d6dee999f9827a694b885d274b7dbbbe6dbf`, base `rebuild-nextjs`, reported MERGEABLE with two successful Vercel contexts at read time. Those contexts alone do not attest full application QA. No automatic merge or hosted SQL deployment is authorised.

The security-only worker grant proposal is kept on a separate branch. Read-only hosted inspection found excess EXECUTE on three private Find My Part worker functions; intentional public marketplace RPCs and participant/admin RPCs must not be revoked indiscriminately.
