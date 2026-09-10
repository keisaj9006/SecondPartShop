# SecondPart Production Environment Matrix

Snapshot: 2026-09-10
Branch: `rebuild-nextjs`
Production Android package: `com.secondpart.marketplace`

This is the canonical setup map for the first real SecondPart Production / Google Play release. It separates runtime configuration from build-time release secrets and from provider-side setup so a release cannot be marked ready simply because code compiles.

Never commit real secret values, keystores, Firebase service-account JSON, Stripe secrets, Supabase service-role keys, reviewer passwords or provider credentials.

## Status vocabulary

- **P0 RC** — required before generating/accepting the first real Google Play release candidate.
- **P0 commerce** — required before real public marketplace money flows are accepted as launch-ready.
- **Operational** — required for production operations but can be configured after the first no-money technical RC where explicitly stated.
- **Optional / staged** — feature may remain disabled because a safe fallback exists.

## 1. Vercel / Production web runtime

| Variable | Sensitivity | Release role | Gate | Verification |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public config | P0 RC + commerce | Core readiness | Production site/auth uses the intended Supabase project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public publishable key | P0 RC + commerce | Core readiness | Normal browser/mobile Supabase client initializes; RLS remains the security boundary. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server secret** | P0 commerce | Core readiness | Admin/webhook/maintenance server operations work; value is never exposed client-side. |
| `NEXT_PUBLIC_SITE_URL` | Public config | P0 RC | Core + mobile readiness | Stable canonical HTTPS Production origin; no Preview/local hostname. |
| `NEXT_PUBLIC_APP_URL` | Public config | Compatibility only | No independent gate | Optional legacy alias; `NEXT_PUBLIC_SITE_URL` is canonical. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Public contact | P0 RC | Public-contact + live-origin gate | Same valid mailbox visible without auth on `/contact` and `/privacy`. |
| `CRON_SECRET` | **Server secret** | P0 commerce / operations | Core readiness | Protects maintenance/reconciliation/deletion/payout scheduled work. |
| `PUSH_DISPATCH_SECRET` | **Server secret** | Operational | Mobile readiness | Optional dedicated push-dispatch authorization; `CRON_SECRET` is the controlled fallback. |
| `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` | **Server secret** | P0 RC for FCM sign-off | Mobile readiness | Server can obtain Firebase OAuth token and send FCM HTTP v1 messages. |
| `ANDROID_APP_LINK_SHA256_FINGERPRINTS` | Public certificate identifiers | P0 RC | Live-origin preflight | Live `/.well-known/assetlinks.json` publishes every required Google Play App Signing SHA-256 fingerprint. |
| `STRIPE_SECRET_KEY` | **Server secret** | P0 commerce | Core readiness | Checkout, Connect, refunds/payout operations use the intended Stripe environment. |
| `STRIPE_WEBHOOK_SECRET` | **Server secret** | P0 commerce | Core readiness | Signed Stripe webhook processing succeeds and invalid signatures fail closed. |
| `STRIPE_API_VERSION` | Server config | Optional pin | No independent gate | Leave blank to use the code-pinned/default API version unless an explicit controlled pin is needed. |
| `STRIPE_CONNECT_API_VERSION` | Server config | Optional pin | No independent gate | Same principle for Connect calls. |
| `OPS_ALERT_WEBHOOK_URL` | **Server secret/config** | Operational before public commerce | Admin readiness | `/admin/system/alerts` returns delivered HTTP 2xx and the fixed smoke alert appears in the intended destination. |
| `OPS_ALERT_WEBHOOK_KIND` | Server config | Operational | Monitoring validator | `generic`, `slack` or `discord` according to the configured endpoint. |
| `OPS_ALERT_WEBHOOK_TOKEN` | **Server secret** | Optional | Monitoring validator | Only when the generic alert destination requires Bearer auth. |
| `OPENAI_API_KEY` | **Server secret** | Optional / staged | Feature-level | Required only if AI Listing drafts remain enabled for Production. Never expose to client. |
| `OPENAI_LISTING_MODEL` | Server config | Optional | Feature-level | Optional explicit model override; otherwise code default applies. |
| `VEHICLE_LOOKUP_PROVIDER` | Server config | Optional / staged | DVSA intentionally outside core gate | Manual vehicle selection remains the release fallback until official DVSA configuration is approved. |
| `DVSA_MOT_CLIENT_ID` | **Server secret/config** | Optional / staged | Vehicle lookup | Configure only with approved DVSA credentials. |
| `DVSA_MOT_CLIENT_SECRET` | **Server secret** | Optional / staged | Vehicle lookup | Configure only with approved DVSA credentials. |
| `DVSA_MOT_SCOPE` | Server config | Optional / staged | Vehicle lookup | Must match approved provider setup. |
| `DVSA_MOT_TOKEN_URL` | Server config | Optional / staged | Vehicle lookup | Must match approved provider setup. |
| `DVSA_MOT_API_KEY` | **Server secret** | Optional / staged | Vehicle lookup | Configure only with approved provider access. |
| `DVSA_MOT_API_BASE_URL` | Server config | Optional / staged | Vehicle lookup | Must target the approved provider environment. |

## 2. GitHub Actions — Android release secrets

These values belong in GitHub Actions secrets/configuration, **not** in the browser runtime and not in source control.

| Secret / input | Sensitivity | Release role | Verification |
| --- | --- | --- | --- |
| `ANDROID_RELEASE_KEYSTORE_BASE64` | **Critical secret** | P0 RC | Restored only inside the Production AAB job; never uploaded as an artifact. |
| `ANDROID_RELEASE_STORE_PASSWORD` | **Critical secret** | P0 RC | Used only to unlock the Production upload keystore. |
| `ANDROID_RELEASE_KEY_ALIAS` | Sensitive config | P0 RC | Alias must exist in the restored Production upload keystore. |
| `ANDROID_RELEASE_KEY_PASSWORD` | **Critical secret** | P0 RC | Used only by Gradle signing configuration. |
| `GOOGLE_SERVICES_JSON_BASE64_PRODUCTION` | **Sensitive Firebase config** | P0 RC | Decoded only into generated Android build workspace for package `com.secondpart.marketplace`. |
| `ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS` | Controlled public identifiers | P0 RC | Live-origin preflight requires every expected Play App Signing fingerprint to be present in Production `assetlinks.json`. |
| workflow input `production_url` | Public config | P0 RC | Must be the stable HTTPS Production origin; live-origin preflight rejects Preview/local/`vercel.app`. |
| workflow input `version_name` | Public release metadata | P0 RC | Captured in release evidence. |
| workflow input `version_code` | Public release metadata | P0 RC | Must monotonically increase between Play releases and is captured in evidence. |

### Signing rule

The **SecondPart upload key** signs the AAB uploaded to Google Play. The **Google Play App Signing certificate(s)** identify APKs installed from Google Play and therefore drive Digital Asset Links. They are intentionally verified separately. See `docs/android-signing-app-links.md`.

## 3. Google Play Console

Provider-side state that cannot be completed by a code commit:

| Item | Release role | Evidence / gate |
| --- | --- | --- |
| Developer account identity/contact verification | P0 RC/submission | Play Console shows verified account state. |
| App created for `com.secondpart.marketplace` | P0 RC | Package exactly matches the Production Android app ID. |
| Play App Signing enabled/configured | P0 RC | App signing certificate fingerprint set recorded and mirrored into Production/App Links configuration. |
| App access / reviewer instructions | P0 submission | Dedicated buyer and seller reviewer credentials entered privately in Play Console. |
| Data Safety | P0 submission | Reconciled against exact AAB, `android-release-permissions.txt`, providers and final Privacy Policy. |
| Account deletion URL | P0 submission | Stable public Production `/account-deletion`. |
| Privacy Policy URL | P0 submission | Stable public Production `/privacy`. |
| Ads / target audience / content rating declarations | P0 submission | Answers match final product behaviour. |
| Store icon, feature graphic, screenshots | P0 submission | Assets represent the final RC, not old Preview UI. |
| Internal / Closed test track | P0 RC / account-dependent Production access | Final AAB installed from Play, not merely sideloaded. |

## 4. Firebase

Two different Firebase inputs exist and must remain separate:

1. **Android client configuration** — `google-services.json`, supplied to the AAB workflow as `GOOGLE_SERVICES_JSON_BASE64_PRODUCTION`.
2. **Server FCM credential** — Firebase service-account JSON, supplied to the Production web runtime as `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`.

Both must point to the intended Production Firebase project/app. The Android client must be registered for `com.secondpart.marketplace`.

Physical FCM sign-off requires a Play-track-installed RC to receive a real notification in foreground and background according to `docs/android-rc-test-matrix.md`.

## 5. Supabase

Required Production state:

- intended Production project URL/publishable key configured;
- server-side service role configured only in trusted server runtime;
- all repository migrations required by the release are applied;
- RLS/grants/service-role RPC boundaries match migrations;
- pending payout-transfer recovery migration is deployed and verified before final money-flow E2E;
- destructive deletion processor migration/state is verified before deletion E2E.

**Current blocker:** the connected Supabase project currently rejects migration inspection with `You do not have permission to perform this action`. Until access is restored, no pending database migration may be assumed deployed.

## 6. Stripe

Before public commerce sign-off:

- intended Stripe test environment is configured first;
- webhook endpoint points to the final Production origin and signature secret matches;
- at least one seller test account reaches payout-ready state;
- real test-mode checkout -> webhook -> fulfilment -> receipt/acceptance -> payout eligibility is completed;
- cancellation, refund, return/case, dispute/reversal and competing-stock paths are exercised;
- only after test-mode E2E is green should live credentials be considered for public commerce.

Use `docs/commerce-e2e-runbook.md`. Never force database payment/payout states merely to make the verifier green.

## 7. Production release order

1. Restore Supabase administrative access and reconcile pending migrations.
2. Choose/register the Production domain and attach it to the Production Vercel project.
3. Configure the Production Vercel runtime values from section 1.
4. Create/configure Play Console app + Play App Signing for `com.secondpart.marketplace`.
5. Register the Production Firebase Android app and configure both Firebase inputs.
6. Configure live `ANDROID_APP_LINK_SHA256_FINGERPRINTS` and matching GitHub `ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS`.
7. Create/back up the permanent Google Play upload key and configure the four Android upload-key secrets.
8. Deploy Production web and verify Admin > System readiness.
9. Run `/admin/system/alerts` and confirm the real critical alert destination.
10. Run the Production AAB workflow. It must pass live-origin preflight, AAB build, merged permission audit, upload-signature verification and evidence generation.
11. Retain the AAB + `android-release-permissions.txt` + release evidence JSON/TXT together.
12. Upload to Play Internal test track and execute `docs/android-rc-test-matrix.md` on a physical device.
13. Run FCM, Stripe commerce E2E and destructive account-deletion E2E.
14. Finalise Play declarations/legal review/store screenshots against that same RC.
15. Only then consider the software release gate complete.

## 8. What is intentionally not a blocker for the first RC

- DVSA registration lookup credentials, because manual vehicle selection is the supported fallback.
- Broad paid buyer marketing, because marketplace liquidity has a separate gate.
- Nationwide Buy + Fit coverage, provided the product does not imply universal availability.

These items still matter to product scale, but they must not be confused with the technical RC gate.
