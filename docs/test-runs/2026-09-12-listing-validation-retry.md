# Listing validation retry QA — 12 September 2026

Status: PASS for validation/Draft retry on actual Preview and reviewed synthetic partial-save recovery. Actual induced provider-failure recovery remains a separate open RC gate.

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

## Verified Preview replay

Commit `8e22927c66f724702ef667f25229dc5f6f178479`; CI `34688830502` succeeded. READY deployment `dpl_8nsKqDSs8duww91ih2RhWYngRU8C`, `second-part-shop-b3ps3zrib-joannakwapis11-5369.vercel.app`. Both Preview aliases read back at that deployment before testing.

Using the existing QA Seller session and fixture, entered £3.25, 90-day warranty, the exact synthetic condition note, Active and one repository PNG. Publication returned the existing missing-evidence error. Price, warranty, note, Active selection, other fields and photo-ready feedback remained. Supabase readback after rejection still showed the original draft, 100 pence, warranty 0, notes null, two metadata rows and two Storage objects: no rejected-publication mutation or upload occurred.

A DOM-isolated browser-tool probe could not expose `input.files` (undefined both before and after submission); its fallback empty array was not valid loss evidence. To resolve this, selected the PNG again, repeated Active rejection, then changed **only** status to Draft and submitted, without reopening the file chooser or re-entering any fields. The normal action redirected to `/dashboard?updated=1`. Supabase now shows draft, 325 pence, warranty 90, the exact retained note, three image rows and three Storage objects. Donor, OEM and part number remain null. This actual submission/upload establishes retained file usability beyond UI feedback.

The new image ID is `3a376057-bc61-4926-8bf8-3f4fbe6cfdaa`, position 2, generated key suffix `2379dfe6-3eaf-4a82-b19d-d91600131335.png`. Public Storage GET returned HTTP 200, image/png, 13,537 bytes; SHA-256 `be4beb74005f654d9018511753830dfebf20b66d769ce9eeca7dcc198f1e2482` exactly matches the repository fixture. Existing cover and second image IDs/paths remain unchanged.

Reopening Edit shows saved £3.25, 90 days, note, Draft and all three photos; the new-file ready feedback is correctly cleared after successful navigation. Keep this unpublished three-photo fixture as the documented QA baseline. No sold Stripe fixture, QA Buyer, Moira, payment, onboarding or compatibility data was changed.

## Final integration follow-up: partial save

Independent review reproduced a second case using the actual update action with synthetic files and mocked Storage: photo A attaches, photo B fails, then retrying both retained files creates three distinct attachments from two selected files. The attached A is not an orphan and must not be deleted by cleanup. Creating a listing has the analogous risk of another draft after the first parent write.

The bounded repair distinguishes pre-write rejection from a confirmed parent write followed by a related-data error. The latter requires recovery through a native link to the saved edit form instead of resubmitting the stale selection. It cancels native/implicit submit and disables the button; the server refuses a supplied recovery marker without trusting or reflecting its contents. Only a database-returned listing ID creates the recovery link. Existing sanitized diagnostics remain visible. This is recovery for the returned action state, not universal request idempotency or atomic upload semantics.

Independent specification and semantic/security re-review PASS. Both actual actions were independently replayed with synthetic A-success/B-failure: one attachment and two upload attempts remain unchanged after retry, with zero additional mutations. Focused listing/image tests 17/17 and photo cleanup boundaries 33/33 PASS. Full suite 233/233, lint (three existing warnings), typecheck, diff check and all 14 validators PASS. Build and deployment acceptance follow. No real Storage failure or alert was induced; that provider failure gate remains explicit in the photo-recovery report.

Final build PASS. Code `e90788390aa903c311cc1c8691e1e2d213258807`, CI `34691988792` SUCCESS, READY Preview `dpl_EG2F8okDfjhK1xjt4N7QpAosMJ5B` (`second-part-shop-7qo6elptg-joannakwapis11-5369.vercel.app`); both aliases read back to that exact HEAD deployment after CI passed.

On that deployment, reopened only the existing QA draft, changed displayed price to £3.26, selected Active and one repository PNG, and submitted the intentionally unsupported publication. The original missing-evidence validation remained effective. Price £3.26, 90-day warranty, note, Active and photo-ready feedback stayed visible; ordinary Save remained available, with no partial-save recovery lock. Database and Storage readback stayed at Draft/325 pence/90 days/unchanged note/three photos/three objects/zero order items. Reloaded the edit route afterwards: Draft and £3.25 restored from saved data, new-file feedback and validation message cleared. No extra upload was performed in this final replay; usable-file Draft retry was already proven above. Partial-write failure/recovery itself was tested synthetically, not induced against Preview Storage.
