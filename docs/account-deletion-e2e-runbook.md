# SecondPart Account Deletion E2E Runbook

Snapshot: 2026-09-11
Branch: `rebuild-nextjs`

This is the destructive QA protocol for the Google Play / privacy release gate. It must be run only against a **disposable QA account** created specifically for this test.

Do not use a founder/admin account, a seller with real listings, a buyer with real orders, or any account containing production evidence that may need retention.

## What this test proves

A passing run proves that the normal SecondPart deletion flow can:

1. accept a user deletion request;
2. claim the request only when privacy/commerce blockers permit it;
3. delete tracked listing images from private Storage;
4. move retained transaction-case evidence through the Storage API to a non-member retained path before Auth deletion;
5. perform the database privacy transformation and identity detachment;
6. verify and hard-delete the Supabase Auth identity;
7. finish the deletion audit row without recreating identity;
8. remain retry-safe if the worker is executed again.

This test does **not** override the retention matrix. Transaction, dispute, fraud, tax/accounting or legal records that have a valid retention basis must be preserved only in the anonymised/detached form defined by `docs/account-data-retention.md`.

## Execution rules

- Use the normal app/UI to create the account and request deletion.
- Use the normal authenticated maintenance endpoint to run the deletion queue when an immediate test run is required.
- Never set `account_deletion_requests.status` manually.
- Never call `claim_account_deletion_request`, `prepare_claimed_account_deletion`, `complete_account_deletion_request` or other deletion-state RPCs manually to make the test pass.
- Never delete the Supabase Auth user manually from the dashboard during the happy-path scenario.
- Never remove database rows manually before verification.
- Never mutate `storage.objects` directly to manufacture ownership cleanup; retained evidence must use the supported Storage API path.
- Do not capture passwords, access tokens, `CRON_SECRET`, service-role keys or full personal addresses in QA evidence.

## Required release evidence

Record:

- Production/QA environment used;
- application commit SHA;
- disposable QA profile ID before deletion;
- deletion request ID;
- request timestamp;
- maintenance run timestamp;
- final request status;
- confirmation that Auth sign-in fails after deletion;
- confirmation that Auth lookup reports the deleted identity absent;
- confirmation that public/private profile identity no longer exists;
- confirmation that disposable personal artefacts are gone;
- confirmation that retained audit/commerce records, if deliberately included in a blocker/anonymisation scenario, are detached rather than pointing at the deleted profile;
- for retained case evidence, confirmation that the stored path no longer contains the deleted profile UUID and the retained object remains available only through the authorised case-evidence access model;
- evidence reference and defect/fix commit for any failure.

Do not retain the disposable account password in the release report after the test is complete.

---

## Scenario A — Happy-path disposable account deletion

Priority: P0

### A1. Create a disposable QA identity

Create a new account through the normal SecondPart sign-up flow using a dedicated QA mailbox/address that can be discarded after the test.

PASS when:
- account is confirmed through the normal auth flow;
- profile exists;
- the account can sign in normally before the deletion request.

### A2. Create disposable personal data through normal product flows

Before requesting deletion, create a small set of harmless user data so the test proves actual cleanup rather than deleting an empty profile. Recommended minimum:

- one Garage vehicle;
- one saved part if an active QA listing exists;
- one saved search if available;
- one support request;
- optionally create a QA seller profile/draft listing and upload one disposable listing image, provided there are no active orders/payout obligations.

Do not create a real financial transaction for the basic happy-path deletion scenario.

Record only identifiers needed to prove cleanup. Do not retain unnecessary personal content.

### A3. Request deletion from the app

Open Account > Security & account and submit the normal deletion request.

PASS when:
- request is accepted through the UI;
- the Admin Privacy queue shows the request as `requested` (or a documented retryable/blocked state if an intentional blocker scenario is being run);
- request belongs to the disposable profile.

### A4. Execute the normal deletion worker

Use the normal maintenance path:

`GET /api/commerce/maintenance`

with the configured server-side maintenance authorization. Do not expose the secret in screenshots or release notes.

The maintenance response contains a `deletions` result from `processAccountDeletionQueue()`.

PASS when the target request is processed by the normal queue and is not advanced through manual database edits.

### A5. Verify final deletion state

After the worker completes, verify:

- deletion request reaches `completed`;
- original Auth identity can no longer sign in;
- direct Auth lookup confirms the identity is absent rather than inferring deletion only from the profile table;
- profile identity is gone/detached as defined by the deletion schema;
- Garage/saved/recent/push and other immediate-personal artefacts for the QA account are gone;
- disposable listing images owned by the deletion context are removed from Storage and their tracked image rows are removed;
- public seller/listing identity is no longer exposed if the QA account created seller data;
- deletion audit record remains without retaining unnecessary member reason/identity linkage beyond the approved design.

PASS only when all expected cleanup checks are satisfied.

### A6. Retry-safety check

Run the normal maintenance worker again after the request is completed.

PASS when:
- the deleted identity is not recreated;
- the completed request is not processed destructively again;
- no duplicate Storage/database error turns a completed deletion into a failed live identity state.

---

## Scenario B — Active commerce blocker

Priority: P0 before public commerce

Use a separate disposable QA account and a controlled test transaction/case. Do not use the happy-path account after it has been deleted.

Create a state that the approved deletion blocker intentionally protects, for example an active buyer/seller commerce obligation, active transaction case or payout state covered by the current blocker RPC.

Request account deletion normally and run maintenance.

PASS when:
- deletion is **not** hard-executed while the active blocker exists;
- request enters/retains a controlled `blocked` or retryable state with the expected blocker code;
- Auth/profile identity remains available only because the blocker legitimately prevents destructive deletion;
- resolving the QA blocker through the normal commerce flow allows a later maintenance pass to continue deletion.

Do not remove the blocker by directly editing status columns.

---

## Scenario C — Buy + Fit blocker

Priority: P0 if Buy + Fit is part of the public RC

Use a disposable account with an active fitting request in one of the blocker-protected states documented by the deletion migration (for example requested/quoted/accepted while still operationally active).

PASS when:
- account deletion does not orphan the active fitting workflow;
- request remains blocked/retryable until the fitting obligation reaches a terminal state;
- after normal workflow resolution, deletion can proceed on a later maintenance pass.

---

## Scenario D — Seller privacy transformation

Priority: P0 before onboarding real sellers

Use a disposable QA seller with:

- seller profile;
- no live financial obligation;
- at least one disposable listing/draft;
- one disposable uploaded listing image.

PASS when deletion:
- removes/detaches seller owner identity according to the retention model;
- removes the seller from active public marketplace exposure;
- archives/unpublishes seller inventory as defined by the processor/migrations;
- removes disposable listing-image Storage objects before Auth hard deletion;
- does not leave the deleted personal identity attached to retained non-personal marketplace/audit facts.

---

## Scenario E — Failure/retry behaviour

Priority: P0 architecture validation; controlled fault injection only in a safe QA environment.

This scenario must not be simulated by corrupting production data.

The intended worker behaviour is:

- if processing fails while identity still exists, request becomes retryable/failed with bounded error audit;
- if the profile was already detached but Auth identity still exists, the next worker pass re-checks Supabase Auth directly and retries the hard delete rather than assuming identity is gone;
- if Auth identity is already gone but final audit completion failed, the request remains recoverable so a later pass can finish the audit without recreating identity;
- completed requests remain idempotent.

If a safe QA fault-injection environment is not available, retain this as code/invariant evidence and do not manufacture a production failure merely to tick the box.

---

## Scenario F — Retained transaction-case evidence

Priority: P0 before public commerce

This scenario proves that evidence with a legitimate retention basis does not prevent hard account deletion. Use a disposable QA transaction/case only; do not use a real customer's dispute evidence.

1. Create a controlled QA transaction case through the normal product flow and upload one harmless evidence file as the disposable user.
2. Resolve the case through the normal workflow so no active-case blocker remains and the account is otherwise eligible for deletion.
3. Record the evidence row ID and its pre-deletion path. Do not retain the evidence content in release notes.
4. Request deletion normally and execute the normal maintenance worker.

PASS when:
- the evidence row required by the retention model remains present but `uploader_profile_id` is detached after profile deletion;
- before Auth hard deletion, the Storage object is moved through the `case-evidence` Storage API to the deterministic retained path `caseId/retained/evidenceId.ext`;
- the retained Storage path no longer contains the deleted profile UUID;
- `original_name` no longer retains the user's uploaded filename and uses the neutral retained-evidence name;
- the retained object remains accessible to authorised transaction participants/admin according to the existing case-evidence access model;
- hard Supabase Auth deletion succeeds despite the retained file;
- a second maintenance pass remains idempotent and does not duplicate, lose or orphan the retained object.

FAIL if the Auth deletion is blocked because the original user still owns retained Storage evidence, or if the test succeeds only after manually editing `storage.objects`.

---

## Verification checklist

```text
Environment:
Commit SHA:
QA account/profile ID:
Deletion request ID:
Requested at:
Maintenance run at:

Scenario: A / B / C / D / E / F
Result: PASS / FAIL / BLOCKED

Request final status:
Auth identity removed as expected: YES / NO / N/A
Profile identity removed/detached as expected: YES / NO / N/A
Immediate personal data removed: YES / NO / N/A
Listing images removed from Storage: YES / NO / N/A
Retained case-evidence path detached from profile UUID: YES / NO / N/A
Retained case evidence still authorised/readable: YES / NO / N/A
Retained records anonymised/detached correctly: YES / NO / N/A
Second maintenance pass idempotent: YES / NO / N/A

Evidence:
Observed blocker/error (if any):
Defect reference:
Fix commit:
Retest result:
```

## Release sign-off

The account-deletion P0 can be marked complete only after at least:

- Scenario A passes end to end on a disposable account;
- retry-safety in A6 passes;
- an active blocker path is proven in Scenario B before public commerce;
- seller cleanup in Scenario D passes before onboarding real marketplace sellers at scale;
- retained transaction-case evidence in Scenario F is proven not to block hard Auth deletion before public commerce;
- evidence is retained without secrets or unnecessary personal data.

Until then, `docs/launch-readiness.md` must keep destructive account-deletion E2E unchecked.
