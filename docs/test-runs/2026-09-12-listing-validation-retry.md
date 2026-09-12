# Listing validation retry QA — 12 September 2026

Status: implementation and independent review passed; post-fix Preview verification pending.

Preview baseline `d243fdb50dbd200b750d75b751b7e1761ebbe0bd`, deployment `dpl_Emre8wSxGZDtKrUkVxfqgmTFEGoP`. Used the existing unpublished QA Seller photo fixture `760fdafa-e589-449e-9296-397f76c74bd2`, with two existing photos, price £1 and no compatibility or identifier claim.

Through the normal edit form, entered £3.25, 90-day warranty, a synthetic QA condition note and one selected `qa-test-part.png` fixture. Selected Active without adding invented fitment evidence. The server correctly rejected publication with its existing requirement for donor, exact fitment, OE/OEM or manufacturer part number; code validates this before database or upload mutation.

After that rejection the UI reset price to £1, warranty to none, notes to blank, status to Draft and the selected photo/ready feedback disappeared. Controlled title/category remained. This is the data-loss regression; the publication guard itself is correct and must remain intact.

Post-fix acceptance: repeat those inputs, retain them on the same rejection, then switch to Draft and save normally using the retained inputs/photo. Confirm the database remains draft and no compatibility evidence is fabricated. Do not touch the separate sold Stripe fixture, buyer identity or Moira.

## Repair and local evidence

The listing form cancels the reset associated with its action submission, retaining native field values and selected files. The image input waits for reset propagation before changing feedback or accepting asynchronous optimization results. A genuine reset still clears the selection; a cancelled reset preserves pending optimization.

Independent review reproduced one additional ordering bug: successful optimization already queued before a genuine reset could restore the old file without ready feedback. The exact regression failed before the reset-completion guard and passed afterwards. Scoped re-review approved the correction.

Focused component/action tests: 12 passed. Full suite: 108 passed. Lint and typecheck passed (three pre-existing mobile-shell lint warnings). Actual create/update action tests reject unsupported publication before uploads or database mutation and preserve successful Draft redirects. Browser FileList retention and the real Draft retry remain separate Preview gates below.

Fresh pre-replay Supabase readback: the fixed QA fixture remains draft, price 100 pence, warranty 0, notes null, stock 1, two images and zero order items. Seller and owner match the documented QA Seller IDs. No fixture mutation was needed for these checks.
Final pre-deployment checks: production build and all 14 repository validators passed; git diff --check passed. These static checks do not replace the pending Preview replay.
