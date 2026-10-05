# Hosted CSV transport hardening — 5 October 2026

This is evidence for the existing bulk inventory flow, not a new import product. Baseline `d90c6122a5697fd84c6b2569984cfb2c10630f25`; branch `codex/csv-transport-limit`. Canonical launch checklist remains `docs/launch-readiness.md`. No hosted data changes, migration, main/Production deployment or real-money operation.

## P1: supported file rejected before application code

The UI and importer advertised 20 MiB, while all hosted upload requests pass through a Vercel Function. One synthetic, unauthenticated 5 MiB request to Preview returned HTTP 413 with `FUNCTION_PAYLOAD_TOO_LARGE`. Raising the Next Server Action body limit cannot change the platform boundary. Source: https://vercel.com/docs/functions/limitations (checked 5 October).

Fix: enforce a shared 4 MiB CSV file limit, leaving space below the 4.5 MB transport ceiling for multipart metadata and bounded action state. Validate the selected file in the browser before submission, retain it for correction, clear the native validation error when a suitable replacement is selected, and return matching server guidance. Larger inventory must be split into files with their header and stable seller references. Keep 5,000 rows per file, draft-only import, 250-row DB chunks, duplicate-reference guards and explicit partial/recovery reporting. This does **not** add a direct-to-Storage or asynchronous 20 MiB upload path, and that larger-file capability is no longer advertised as supported.

Regression: prior implementation failed all three tests for exact 4 MiB/one-byte-over, matching UI guidance and pre-submit file validity. The tests now consume the actual shared constants rather than reproducing hardcoded limits in mocks. All passed after the fix.

## P1: previous preview state can overflow a subsequent request

Independent review identified unbounded `sample.priceGbp`. A valid numeric amount with 3 MiB of leading zeros produced a similarly large preview result. `useActionState` sends previous result data with the next file, so the valid Preview → Import sequence could exceed the platform ceiling despite the file guard.

The regression failed before the repair and now verifies the normalized bounded amount and combined file/serialized-state budget. Valid prices are projected as fixed two-decimal amounts; invalid sample fields are capped at 32 characters. Other sample fields and issue collections were already bounded. Arbitrarily crafted malicious multipart/action state is not assumed valid or made immune to the hosting limit.

## P1: monetary preflight accepts database-invalid values

`1e308` passed finite pound validation but overflowed when converted to pence; £21,474,836.48 exceeded the PostgreSQL integer maximum. Previously the test importer treated both as valid and attempted writes; the real database would reject them at runtime. Two failing regressions now verify zero batches/drafts before rejection. Money conversion requires finite non-negative values and safe integer pence within the existing database column's range, not a newly invented commercial price cap.

Focused importer/diagnostic suite passed 18 tests on the pre-parser-merge boundary. Full regression, validators, independent follow-up review and exact-head Preview results must pass before merge. Physical/mobile and real authenticated maximum-file UI proof remain separate gates. The photo multipart transport issue is not fixed by this CSV repair.
