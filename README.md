# SecondPart — modern rebuild

Next.js marketplace MVP for verified automotive parts in the UK. This branch is a clean rebuild; the PHP application remains preserved on `main` as legacy reference.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The marketplace currently uses a typed in-memory repository so the complete buyer flow renders without credentials. Apply `supabase/migrations/0001_marketplace.sql` and configure the environment variables to activate persistent accounts, listings and saved parts.

## Product slices

- Buyer-first marketplace search and category filters
- Vehicle-first search context and technical identifiers
- Listing detail and compatibility evidence
- Saved-state interaction
- Seller onboarding/dashboard foundation
- PostgreSQL/Supabase marketplace schema with row-level security
