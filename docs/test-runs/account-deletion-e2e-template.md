# Account Deletion E2E Evidence — Template

Use this file as the redacted evidence template for the destructive account-deletion release gate. Copy it to a dated file such as `docs/test-runs/2026-09-10-account-deletion-e2e.md` only after running the real scenario through the normal SecondPart UI and maintenance worker.

## Safety rules

- Use only a disposable QA account created specifically for this test.
- Do not use a founder/admin account, smoke-test account, real customer, real seller or account with production evidence.
- Do not record passwords, access/refresh tokens, `CRON_SECRET`, service-role keys, payment secrets or full personal addresses.
- Do not manually edit deletion status or call deletion-state RPCs to manufacture a PASS.
- The Admin Privacy `QA preflight (read-only)` view may be used to verify identifiers and operational state, but it must not replace the normal worker.

## Run metadata

```text
Environment:
Commit SHA:
Run date/time (Europe/London):
Scenario: A / B / C / D / E
Result: PASS / FAIL / BLOCKED

Disposable QA profile UUID:
Deletion request UUID:
Requested at:
Maintenance run at:
Second maintenance pass at:
```

## Read-only preflight

```text
Request state before worker:
Stored blocker before worker:
Attempt count before worker:
Profile identity before worker: PRESENT / MISSING
Auth identity before worker: PRESENT / MISSING / UNKNOWN
Worker candidate: YES / NO
Identity detached before worker: YES / NO
Processor error recorded: YES / NO
```

A blank stored blocker is not proof that deletion is safe. The normal worker must perform the authoritative blocker check when it claims the request.

## Required post-run assertions

```text
Deletion request final status: COMPLETED / BLOCKED / FAILED / OTHER
Auth sign-in fails after successful deletion: YES / NO / N/A
Auth identity absent after successful deletion: YES / NO / N/A
Profile identity removed/detached as expected: YES / NO / N/A
Immediate personal data removed: YES / NO / N/A
Listing-image Storage objects removed: YES / NO / N/A
Tracked listing-image rows removed: YES / NO / N/A
Public seller/listing identity hidden or detached: YES / NO / N/A
Retained commerce/audit records detached correctly: YES / NO / N/A
Retained case-evidence path no longer contains deleted profile UUID: YES / NO / N/A
Retained case evidence remains readable to authorised transaction participants/admin: YES / NO / N/A
Retained case evidence does not block hard Auth deletion: YES / NO / N/A
Second maintenance pass is idempotent: YES / NO / N/A
```

## Evidence and defects

Record only non-sensitive identifiers, screenshots with unnecessary PII redacted, and concise observations.

```text
Evidence references:
Observed blocker/error:
Defect reference:
Fix commit:
Retest result:
Notes:
```

## Sign-off

Do not mark the destructive account-deletion item in `docs/launch-readiness.md` complete unless the minimum scenarios required by `docs/account-deletion-e2e-runbook.md` have actually run and passed. This template by itself is not release evidence and is not a PASS.
