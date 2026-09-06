# SecondPart — UK automotive-parts marketplace

SecondPart is a modern marketplace for used automotive parts in the UK. The legacy PHP application remains on `main`; active rebuild work is isolated to `rebuild-nextjs`.

## Current product state

The current branch contains the marketplace foundation plus the first trust and commerce-core layers:

- buyer and seller authentication
- public marketplace listings and product detail pages
- hierarchical automotive categories
- UK vehicle-first search with registration lookup support and manual fallback
- provider-neutral DfT vehicle catalogue integration
- explicit seller fitments and compatibility confidence
- unified search for part names, categories, OE/OEM numbers, part numbers, brands and keywords
- saved parts, saved searches and recently viewed parts
- SecondPart Garage
- buyer part requests and seller demand leads
- donor vehicles
- seller listing create/edit/archive/stock/photo management
- listing quality and trust evidence
- seller verification and marketplace reporting
- notifications
- account security and deletion-request flow
- support, help, privacy, terms and buyer-protection pages
- Row Level Security across application tables
- public member usernames and reputation profiles
- verified-transaction buyer/seller reviews with double-blind publication
- seller type (business/private), seller profile editing and reputation metrics
- buyer Purchases and seller Sales & payouts hubs
- transaction/order/payout state foundation and audit events
- representative vehicle visuals in SecondPart Garage using persisted vehicle colour
- installable PWA metadata plus a developer Android APK workflow
- private seller payment-account state separated from public seller profiles
- Stripe Connect Accounts v2 onboarding integration scaffold

**Live payment capture is not enabled yet.** Checkout, Stripe webhooks, transfer release, automated refunds/returns/disputes and real seller payouts still require Stripe test credentials, end-to-end testing and release-policy approval.

## Stack

- Next.js App Router
- React
- strict TypeScript
- Tailwind CSS
- Supabase Auth
- PostgreSQL
- Supabase Storage
- Supabase Edge Functions
- Server Components for data reads
- Server Actions for authenticated writes

## Branch safety

Development for this rebuild must remain on:

```text
rebuild-nextjs
```

Do not merge into or deploy `main` while the rebuild is under active validation.

## Supabase

The active Supabase project is migration-driven. The authoritative SQL history is the ordered set of files in:

```text
supabase/migrations/
```

Do not run an old single-file prototype migration. Apply missing migrations in order using the normal Supabase migration workflow for the target environment.

Development seed/reference data lives in:

```text
supabase/seed.sql
```

The imported DfT vehicle catalogue is provider-neutral statistical/licensing data. It must not be described as a complete OEM fitment catalogue. Vehicle existence and part compatibility are separate concepts; buyer compatibility claims come from explicit fitment evidence.

## Vehicle registration lookup

The application includes a server-side DVSA MOT History adapter. Configure it only with server-side environment variables:

```bash
VEHICLE_LOOKUP_PROVIDER=dvsa_mot_history
DVSA_MOT_CLIENT_ID=
DVSA_MOT_CLIENT_SECRET=
DVSA_MOT_SCOPE=
DVSA_MOT_TOKEN_URL=
DVSA_MOT_API_KEY=
DVSA_MOT_API_BASE_URL=https://history.mot.api.gov.uk
```

When provider credentials are not configured, the application must return a controlled unavailable state and must not fabricate a vehicle result.

## Core environment variables

Copy `.env.example` to `.env.local` for local development.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_your-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Commerce / Stripe Connect (server-side unless explicitly NEXT_PUBLIC)
NEXT_PUBLIC_APP_URL=https://your-https-preview-or-domain
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_CONNECT_API_VERSION=2026-08-26.preview
```

Never commit `.env.local`, service-role keys or provider credentials.

## Product images

Seller listings support:

- JPG, PNG and WebP
- maximum 5 MB per image
- maximum 6 images per listing
- at least one real product image before an active listing can be published

The Server Action request limit is sized to support six 5 MB images plus multipart overhead. Server-side validation still enforces the per-file and per-listing limits.

## Local development

```bash
npm install
npm run dev
```

Default local URL:

```text
http://localhost:3000
```

## Validation

Run all checks before creating a Preview:

```bash
git diff --check
npm run lint
npm run typecheck
npm run build
```

GitHub Actions runs the rebuild QA workflow for `rebuild-nextjs`.

## Important architecture rules

- ordinary buyers should not need gearbox codes to find normal parts
- gearbox metadata is contextual for transmission-related categories
- do not fabricate registration results
- do not fabricate part compatibility
- preserve imported vehicle provenance
- preserve existing QA fitments until they are safely migrated
- keep privileged Supabase credentials server-side
- do not weaken RLS to solve application bugs
- active listings should only become public after required related data has been saved

## Current roadmap

The marketplace foundation and Trust Layer are implemented. Commerce Core is now in progress. The next sequence is:

1. fresh Vercel/mobile QA of the Trust + Vehicle Visual changes
2. connect Stripe **test-mode** credentials and validate seller onboarding
3. implement checkout + webhook-driven payment state
4. implement protected transfer release, delivery/acceptance, refunds/returns/disputes
5. end-to-end buyer/seller transaction QA before any live payments

See `docs/pre-payments-roadmap.md` and `docs/product-decisions.md` for the current product decisions and deferred commerce work.
