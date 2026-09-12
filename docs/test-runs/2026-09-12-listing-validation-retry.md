# Listing validation retry QA — 12 September 2026

Status: PASS for Task 6, including actual Preview rejection, retained-photo Draft retry and provider readback.

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
