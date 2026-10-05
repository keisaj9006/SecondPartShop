# Next.js dependency hardening — 5 October 2026

Baseline: `1d4fd279684ee8faf15fee23d9818efdc85382b0` from `rebuild-nextjs`. Separate branch: `codex/next-security-2026-10-05`. This repair is independent of the unmerged DVSA PR #10.

## Finding and narrow repair

`npm audit --omit=dev --json` failed with one critical production advisory, [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), for installed Next.js 16.3.4. The provider identifies attacker-controlled SVG values passed to Node.js `next/og ImageResponse` as the vulnerable path. No `next/og` or `ImageResponse` use was found in `src`; application exploitability is therefore not demonstrated. Treat the affected runtime dependency as a P1 before public launch, without claiming an observed compromise.

Updated exact `next` and matching `eslint-config-next` pins to 16.3.8 and regenerated the lockfile. No React upgrade, codemod, framework architecture change, dependency override or major downgrade. Added `validate:dependencies` (`npm audit --omit=dev --audit-level=high`) and run it after `npm ci` in the existing QA workflow. The gate prevents a known high/critical production advisory from silently passing that workflow.

## Evidence

- RED: production audit found the critical Next.js advisory.
- GREEN: production audit has zero vulnerabilities after the patch.
- Full suite: **694 passed, zero failed**. This canonical baseline does not include the 23 unmerged DVSA tests; do not confuse it with the 717-test PR #10 run.
- Lint passed with zero errors and four pre-existing unused-variable warnings.
- Independent read-only review: no actionable issues in version pins, lock consistency or audit gate.
- Production build, explicit typecheck, `git diff --check` and the new production dependency validator passed. Hosted QA/Preview are pending at this checkpoint.

No bespoke manifest test was added: the provider audit is the actual regression detector, backed by the existing functional/SQL suite and build. No secrets, migrations, main or Production changes.

## Residual development-only audit

The full development audit reports six high severity entries in the braces/micromatch/fast-glob/Next lint chain and brace-expansion. These are not production dependencies in the production-only audit. The suggested force fix includes downgrading eslint-config-next to another major; it was not applied. Upstream maintenance remains P2 at this boundary, with trusted local/CI file patterns, without claiming that the full development tree is clean.
