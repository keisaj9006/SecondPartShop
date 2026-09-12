# Operational log redaction QA — 12 September 2026

Status: independent review round 1 approved; release verification in progress.

## Confirmed causes

The shared operational logger omitted Stripe signing secrets, Supabase secret keys, standalone JWTs and intent client secrets. Initial four synthetic tests reproduced all four cases. Independent semantic review then caught a long JWT sliced before recognition, a dotted diagnostic falsely treated as JWT, context keys bypassing sanitization, and an analytics provider exception logged directly.

## Scope and safety

Repair the shared sanitizer and the confirmed analytics log bypass. Preserve safe Stripe object IDs, statuses, error codes and useful diagnostics. Keep processing bounded and redact recognizable sensitive fragments before truncation can expose them. Do not record request bodies, auth credentials, webhook signatures or provider payloads as test evidence.

All error/credential fixtures are synthetic. Reporter tests capture console output and mock alert transport; analytics tests mock the provider boundary. No real secret, account creation, payment, provider failure or external alert is used.

## Inspected paths

Web/mobile checkout, Stripe webhook, payout setup/sync, reconciliation and uncaught request errors use the shared reporter. Photo cleanup logs fixed messages. The inspected auth, image upload and provider helpers have no direct logging bypass; marketplace analytics had the confirmed raw caught-error bypass. This is source and synthetic boundary evidence, not a claim that every possible external provider payload is known.

## Release gates

Independent review, regression results, full checks, code commit, CI and exact-commit Preview will be recorded after completion. External alert delivery remains a separate authorized release gate and will not be triggered by this task.


## Review and regression result

Independent rereview approved specification compliance and code quality after all four findings were addressed. Focused tests: 8/8; full suite: 84/84. Monitoring (25 invariants), commerce E2E harness, account deletion harness and mobile performance validators passed. Tests verify fragments of long synthetic JWTs at 80/240/700-character output limits, sanitized context keys and caught analytics errors/codes, with ordinary dotted diagnostics and `PGRST116` retained. No suite substitutes for an actual external alert test.
Final pre-commit checks: lint exit 0 (three existing mobile-shell unused-variable warnings), typecheck, production build and git diff --check passed. The build used public placeholder Supabase settings, not provider secrets.
