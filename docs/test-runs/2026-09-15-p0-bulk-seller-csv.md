# SecondPart bulk seller CSV evidence — 2026-09-15

## Scope

Hosted QA Supabase evidence plus inherited importer/UI regression coverage on `rebuild-nextjs`. No new CSV was uploaded and no existing QA batch/listing was modified during this verification.

## Existing genuine partial import

QA Supabase already contains a real seller CSV import batch:

- batch: `60ce6125-27a0-44da-bde6-335284708bb5`
- seller: `58ecccc3-5162-4826-9c3f-81dbd92a6007`
- source channel: `csv`
- status: `partial`
- rows received: `2`
- drafts created: `1`
- rows rejected: `1`
- rejected row: row `3`, `price_gbp must be a valid non-negative amount.`

The one created row is durably linked to that batch:

- part: `f4d9de01-b71b-4e48-8f6c-f7fcb66df2d0`
- title: `[QA TEST] RC CSV draft A`
- status: `draft`
- stock: `1`
- source channel: `csv`
- seller reference: `QA-RC-CSV-20260912-A`
- `import_batch_id` matches the partial batch exactly.

This closes the old evidence gap that claimed there was no actual partial-import record.

## Retry and duplicate protection

The importer requires `seller_reference` and checks existing references before writes through `get_existing_csv_inventory_references`.

The deployed lookup function is `SECURITY DEFINER` but seller-owner scoped through `s.owner_id = auth.uid()` and performs case-insensitive matching. A hosted RLS/auth probe confirmed:

- QA seller owner can resolve `qa-rc-csv-20260912-a` as the existing reference;
- unrelated authenticated buyer receives zero matches for the same reference.

The database also has a unique partial index:

`parts_seller_source_external_unique (seller_id, source_channel, lower(source_external_id)) WHERE source_external_id IS NOT NULL`

A rollback-only hosted PostgreSQL probe attempted a duplicate CSV reference using a lower-case version of the existing QA seller reference. The deployed unique index rejected it with `unique_violation`; the transaction was rolled back.

## Import report authorization

`seller_inventory_imports` has owner-scoped INSERT/SELECT/UPDATE RLS, with admin read additionally allowed. A hosted auth probe confirmed:

- QA seller can read its own partial batch;
- unrelated authenticated buyer reads zero rows for that batch.

The report page itself starts with `requireSeller`, resolves the seller from the authenticated owner, and calls `getInventoryImportReport(seller.id,id)`. The data loader additionally filters both `id` and `seller_id` before returning the report.

## Permanent regression coverage

`scripts/test-bulk-inventory-import.mjs` covers the failure/retry boundaries that are difficult to prove from one hosted batch alone:

- reference-lookup failure retains the CSV, leaks no provider payload and writes nothing;
- repeated files without a stable seller reference create no rows;
- partial retry creates only rows not previously created and treats seller references case-insensitively;
- report-finalization DB error or zero-row acknowledgement returns explicit recovery rather than false success;
- recovery warns not to upload the same file again after rows may already exist;
- exact 5,000-row boundary accepted, 5,001 rejected;
- exact 20 MiB boundary accepted, one byte over rejected;
- preview retains selected CSV;
- post-write recovery clears the file and exposes batch/draft recovery links;
- UI presents the shared limits and revalidates imported drafts after recovery.

These tests are part of the full `npm test` suite that passed at the clean code boundary `03b62cfb0747cda006d6c0158097b80fcf2f459a` in GitHub Actions run `34998569234`.

## Classification

**VERIFIED:** a genuine hosted partial-import batch exists; created drafts are batch-linked; rejected-row accounting is durable; report visibility is owner-scoped; reference lookup is seller-scoped and case-insensitive; the deployed database enforces case-insensitive seller/source reference uniqueness; permanent regressions cover partial retry and ambiguous-finalization recovery.

A fresh manual replay of this exact historical partial CSV through the current browser UI was not performed during this verification. It is no longer required to prove that partial import has occurred, but browser-only UX observations remain separate from the hosted data/importer contract proved here.
