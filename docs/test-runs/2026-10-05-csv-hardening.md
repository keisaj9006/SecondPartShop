# CSV integrity hardening — 5 October 2026

Canonical baseline: `d90c6122a5697fd84c6b2569984cfb2c10630f25`, `rebuild-nextjs`. Independent branch: `codex/csv-integrity-hardening`. DVSA PR #10 remains open pending the genuine authenticated Garage journey; this independent repair does not bypass that gate. No main/Production change, provider money transaction, hosted data write or migration.

## P1: malformed CSV silently changes inventory content

Reproduction: upload an otherwise valid inventory row with an extra unquoted cell, quotes inside an unquoted title, or text after a closing quote. Previously all three returned import success and created a draft in the deterministic importer harness. The parser discarded extra cells or stripped misplaced quote characters instead of reporting a syntax error. This can silently alter a seller's imported stock data.

Fix: reject the malformed CSV before inventory validation/database queries, return a safe actionable syntax error, retain the file for correction. Preserve legitimate quoted commas, doubled quotes, multiline CRLF values, BOM, Unicode, supported extra header columns and the existing optional trailing-cell defaults. No automatic publication, transaction or ownership behaviour changes.

Regression: three import-level tests failed before the fix (`success` instead of `error`), passed afterwards and verify zero draft/batch writes. A positive parser fixture protects legitimate quoted Unicode/multiline data. Focused bulk-import/diagnostic suite: 18 passed, zero failed. The existing 5,000-row and 20 MiB parser-only boundary fixtures still pass; these do not establish hosted upload support.

## Separate open P1: hosted transport limit

One synthetic unauthenticated 5 MiB request to the Preview mobile seller import endpoint returned HTTP 413 with `FUNCTION_PAYLOAD_TOO_LARGE`, before application processing. No user/session/inventory data was supplied. This confirms that the existing 20 MiB CSV and 35 MB Next Server Action limits cannot override the Vercel platform limit. UI/server transport limits and large-file handling must be corrected in a separate reviewable repair. Photo multipart uploads need the same transport audit. Do not mark hosted maximum-file tests verified from the local parser tests.

Official source checked 5 October: https://vercel.com/docs/functions/limitations and https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions.

This evidence report supplements the canonical launch checklist; it is not a competing release plan or full RC sign-off. Remaining provider/session/device gates retain their status. Full local/remote validation, exact-head Preview and independent review results will be correlated in the PR before merge.
