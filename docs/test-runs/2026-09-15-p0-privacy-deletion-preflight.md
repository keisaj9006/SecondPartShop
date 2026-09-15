# SecondPart privacy/deletion hosted preflight — 2026-09-15

## Scope

Read-only verification of the deployed QA Supabase deletion boundary plus inherited CI regressions. No deletion request was created, claimed, finalized or executed against an existing QA account.

## Retention/minimization contract

The source-of-truth engineering retention matrix is `docs/account-data-retention.md`. It explicitly separates minimum retained transaction/accounting evidence from personal data that should be erased sooner, and keeps final legal periods/wording subject to UK legal review.

## Deployed finalizer

The hosted `public.prepare_claimed_account_deletion(request_id, profile_id)` definition now contains the reviewed minimization behavior that was previously missing from the deployed database:

- validates that the exact deletion request is claimed for the exact profile and is in `processing`;
- runs `private.account_deletion_blocker(profile_id)` and moves the request to `blocked` instead of destructively proceeding when a blocker exists;
- deletes pre-purchase listing conversations and public review linkage;
- clears retained order shipping name/address where this deletion phase is allowed to proceed;
- clears fitting-request registration and buyer notes;
- removes seller part-image metadata before detached seller retention;
- removes seller payment-account rows;
- clears donor-vehicle registration and notes;
- clears seller inventory-import filename and error summary;
- removes postcode/geolocation/verification/description data from retained seller rows;
- gives every retained seller a deterministic non-identifying `deleted-seller-*` public slug and `Deleted` location;
- private sellers receive the non-identifying `Deleted seller` name; registered-business naming remains preserved pending the explicit legal-review item documented in the retention matrix;
- garage profiles are suspended, unverifed and receive non-identifying deleted slugs/location copy.

The function ACL is `postgres` + `service_role` execute only; it is not directly callable by anon/authenticated clients.

## Current hosted state

A read-only aggregate query found zero rows in `account_deletion_requests`, so there is no existing pending/processing request that could be affected by this verification.

The clean CI at code boundary `03b62cfb0747cda006d6c0158097b80fcf2f459a` passed both the account-deletion minimization tests and `validate:account-deletion-e2e` along with the full integrated suite.

## Classification

**VERIFIED (engineering/deployed preflight):** deletion blocker/finalizer definition, privacy minimization fields and service-role authority are present on hosted QA Supabase and match the engineering retention contract for the inspected boundary.

**UNSIGNED / external:** a full destructive Auth + database + Storage deletion E2E still requires a deliberately disposable authenticated test account. Existing QA accounts must not be deleted to manufacture evidence. Final UK legal retention periods, registered-business-name treatment and public Privacy Policy wording remain legal/business sign-off items rather than engineering PASS claims.
