# Case evidence signed-URL fail-closed hardening — 2026-09-18

Branch: `rebuild-nextjs`

This checkpoint covers read/display of private transaction-case evidence on web and mobile. It does not alter evidence upload limits, case policy, Storage bucket privacy, Supabase schema, Stripe, Production or `main`.

## Root cause

Both the web case-evidence loader and mobile evidence GET route generated signed Storage URLs in parallel, but silently omitted an evidence row when a signed URL was missing.

That meant a temporary Storage/signing failure could make a real dispute/return evidence file appear as if it had never been attached. Partial evidence lists are unsafe for transaction-case review because absence of an item can be interpreted as absence of evidence.

Uploader-profile lookup fallback is different: it only affects the display label and already safely falls back to `member` / `deleted-member`. That behavior is intentionally unchanged.

## TDD RED

Regression commit:

- `b48d73787a1c81b08aff49d697ee76252c8a0a05`
- GitHub Actions run: `35355440519`

Expected RED:

- total tests: 604;
- 602 PASS;
- 2 FAIL;
- web evidence loader did not reject when one signed URL failed;
- mobile evidence GET returned HTTP 200 instead of a controlled 503;
- success-path evidence tests were already green.

## GREEN implementation

Web implementation:

- `fd90e1d489f4c090ea514a625adc385912a2ee1a`;
- after signed URL generation, any Storage error or missing signed URL now throws `Case evidence file is temporarily unavailable.`;
- the page therefore reaches the existing retry error boundary instead of rendering incomplete evidence.

Mobile implementation / final application SHA:

- `efa24de9e59cd2a3fdd63c3141b33e177989f8b7`;
- any signed URL error/missing URL returns HTTP 503 with `evidence_url_unavailable`;
- no partial evidence list is returned.

Evidence upload POST behavior is not changed by this fix.

## Final verification

GitHub Actions run `35355788417`:

- `validate`: PASS;
- `last-stock-concurrency`: PASS;
- `marketplace-scale-postgres`: PASS;
- tests: **604/604 PASS**, 0 FAIL;
- lint: PASS;
- typecheck: PASS;
- release/commerce validators: PASS;
- production Next.js build: PASS; compiled successfully in 8.1s.

Vercel Preview:

- deployment: `dpl_8GymWULrVX4rfPAGKMtWquQa1sLu`;
- exact URL: `https://second-part-shop-j9j8020sz-joannakwapis11-5369.vercel.app`;
- stable branch alias: `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`;
- state: READY.

Fresh read-only health smoke on exact deployment and branch alias returned HTTP 200 with `backendReady:true`.

## Follow-up discovered during audit

If a case-evidence file upload succeeds but `register_transaction_case_evidence` fails, web/mobile attempt a one-shot admin Storage delete. There is currently no durable retry queue for a failed cleanup. This is a separate orphan-file cleanup boundary and is not claimed closed by this checkpoint.
