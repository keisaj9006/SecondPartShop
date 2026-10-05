# Photo transport guard — 5 October 2026

Baseline: `50c673303af612a709f3d5b73071681d38bd400f` on `rebuild-nextjs`, including merged CSV PRs #12/#13. Branch: `codex/photo-payload-guard`. No Storage/database writes, policy changes, migration, main or Production deployment.

## P1: individually valid photos exceed total hosted request budget

Reproduction: select two individually allowed files, 3 MiB and 2 MiB, on a browser without image optimization. The previous component marked both ready to upload. The combined payload exceeds Vercel's 4.5 MB ceiling before the application can issue a controlled response. The same architectural boundary applies to the raw multi-image case-evidence form. The platform limit itself was reproduced with a synthetic Preview request in the CSV transport evidence.

Fix: check the complete listing photo selection **after** device compression and before marking it ready or updating the upload FileList. Reject totals above 4 MiB with guidance to select fewer/smaller files. Preserve the existing optimization, MIME checks, source-image limit, six-photo listing rule and asynchronous reset guards. Case-evidence selection is checked before submitting; it is retained for correction and a valid replacement clears the error. Its guidance states the actual 4 MiB aggregate request budget. The Storage/server per-file 5 MiB limit remains a separate defense, not a claim that 5 MiB proxy uploads work.

Regression: the two-file listing reproduction failed before the repair (incorrect ready feedback) and passed afterwards. Boundary selection at 4 MiB remains ready. Case-evidence tests verify aggregate rejection, retained selection, corrected replacement and no input for a user without upload permission. All nine focused tests passed; existing genuine/cancelled reset and stale asynchronous optimization cases still pass.

This is client-path transport protection, not provider/Storage end-to-end upload proof. Direct-storage large uploads, actual seller/evidence maximum-file UI tests, corrupted-image/decode adversarial testing and physical camera/gallery checks are not signed off by these synthetic tests. Arbitrarily crafted large requests can still be refused by hosting before application code. Full regression, exact-head Preview and independent review are required before merge.
