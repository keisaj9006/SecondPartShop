# SecondPart — Supabase marketplace MVP

Modern rebuild of the SecondPart UK automotive-parts marketplace. The legacy PHP application remains on `main`; all rebuild work lives on `rebuild-nextjs`.

## Current stack

- Next.js App Router, React and strict TypeScript
- Tailwind CSS
- Supabase Auth, PostgreSQL and Storage
- Server Components for data reads and Server Actions for authenticated writes

## Supabase setup

Use a new Supabase project for this milestone. No service-role key is required by the application.

1. Open **SQL Editor** in Supabase and run `supabase/migrations/0001_marketplace.sql` once.
2. Run `supabase/seed.sql` once to create the development categories, sellers, vehicles, DSG parts and fitments.
3. In **Authentication → URL Configuration**, set the local Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL.
4. Copy `.env.example` to `.env.local` and replace the placeholder URL and anon key with values from **Project Settings → API**.
5. Start the app with `npm run dev`.

The migration creates the public `part-images` Storage bucket and its ownership policies. Product images accept JPG, PNG or WebP files up to 5 MB.

If the earlier prototype migration was already applied to a Supabase project, use a fresh project or reset that development database before running this migration. The prototype schema was incomplete and is intentionally replaced rather than patched in production.

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Never commit `.env.local` or privileged Supabase keys.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```

## Implemented product flows

- Public database-backed marketplace and product details
- Search by title, OEM number, part number, gearbox code and family
- Category, condition, gearbox and price filters
- Relational Make → Model → Generation → Year → Engine → Gearbox selection
- Supabase sign-up, confirmation callback, sign-in, sign-out and profile creation
- Persistent saved listings
- Public seller directory and profile pages
- Protected seller profile onboarding
- Seller listing create, edit, archive and stock management
- Product image upload to Supabase Storage
- Row Level Security for public, buyer, seller and future admin access

Payments, checkout, VIN lookup, messaging, reviews and advanced administration are intentionally outside this milestone.
