# Vehicle registration lookup incident — 27 October 2026

## Scope and safety

The audit used Preview only. Production, Supabase schema/data, payments and provider credentials were not changed or printed. Repository work was isolated from the existing local worktree on `codex/vehicle-lookup-fix`, based on exact SHA `b35864cc87714f7a16703be53985644758f7b410`.

## Root cause

`https://second-part-shop-preview.vercel.app` pointed to Preview deployment `dpl_5wSDfrhiMYDs2mKEAdBbyqM3zLrm`, built from `rebuild-nextjs` SHA `4a9c909c8d33732dff4f674be20540d55e5f17b1` on 30 September. That deployment pre-dated the configured DVSA environment and returned the safe no-credentials response. Failure category: `auth_missing` at the deployment configuration stage.

The exact branch alias pointed to READY Preview deployment `dpl_7kRBJQ7xxTtj7fQ7qTncvFqtcVuC`, built from SHA `b35864cc87714f7a16703be53985644758f7b410` on 8 October. It had the five required DVSA variable names and no Vehicle Data Global variables. No values were read.

The friendly Preview alias was reassigned to the already-existing exact-SHA deployment; no new deployment was created. A post-change request to the friendly alias returned HTTP 200.

## Live provider evidence

The first controlled request for the owner-authorized known registration through the branch alias returned HTTP 200 and a complete reduced vehicle identity. The registration and returned attributes are intentionally omitted from committed evidence.

The catalogue strategy was `dvsa_to_dft`, with derivative confirmation still required.

The read-only cache record was created at `2026-10-27 09:59:47.277+00` under provider `dvsa_mot_history`, immediately after that request. This proves the result was not an older cached answer. The request also proves the operational rate-limit RPC permitted the call, OAuth succeeded, DVSA returned a usable response, mapping succeeded and DfT catalogue resolution completed.

## Repository hardening

Server-side diagnostics now classify provider/configuration failures without logging credentials, tokens, upstream bodies or full registrations. Logs contain a fixed event name, safe code, stage, optional HTTP status and a SHA-256 registration hash. The mobile route now distinguishes operational-guard failure (`503`) from actual quota exhaustion (`429`).

Vehicle Data Global was not implemented: no corresponding Preview credentials exist, and the canonical product decision keeps it as an optional paid later-stage provider. Automatic paid fallback remains disabled.

Manual vehicle selection remains the outage path. Existing selected vehicle data can remain visible as explicitly labelled manual/current selection, but a failed lookup clears the returned-registration state and cannot be applied as a newly confirmed registration result.
