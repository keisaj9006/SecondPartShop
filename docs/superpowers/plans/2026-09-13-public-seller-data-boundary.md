# Public Seller Data Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent seller postcode/geocoding data from being publicly readable while preserving owner profile editing and server-side distance search.

**Architecture:** Replace table-wide seller read privileges with a public column whitelist and an authenticated owner-only RPC for private profile fields. Public listing/seller projections stop selecting postcode, and public mobile responses are defensively serialized through `toPublicListing()`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/PostgreSQL 17, PostgREST, GitHub Actions, Vercel Preview.

**Spec:** `docs/superpowers/specs/2026-09-13-public-seller-data-boundary-design.md`

## Global Constraints

- Work only on `rebuild-nextjs`; do not modify `main` or Production.
- Do not remove postcode from seller-owned settings or server-side distance calculations.
- Do not expose `postcode`, `latitude`, `longitude`, `postcode_geocode_approximate`, `postcode_geocoded_at`, or `account_deleted_at` through public seller reads.
- Public seller location remains the existing general `location` string.
- Use TDD: preserve the current RED proof before implementation and make the same tests GREEN.
- Deploy the migration only to the existing QA Supabase project before claiming completion.

---

### Task 1: Lock the database seller read contract

**Files:**
- Create: `supabase/migrations/20260913160500_public_seller_data_boundary.sql`
- Modify: `scripts/test-public-seller-data-contract.mjs`

**Interfaces:**
- Produces: `public.get_own_seller_profile_private()` with no arguments.
- Produces: column-level seller SELECT grants for `anon` and `authenticated` limited to `id,owner_id,business_name,slug,location,description,verified_at,seller_type,business_kind`.

- [ ] **Step 1: Extend the failing regression test**

Add assertions that the migration exists, revokes table-level seller SELECT, grants only the approved public columns, defines `get_own_seller_profile_private()`, binds it to `auth.uid()`, and grants execution only to `authenticated`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test scripts/test-public-seller-data-contract.mjs`
Expected: FAIL because the migration/RPC do not exist and the four existing public leak assertions still fail.

- [ ] **Step 3: Write the migration**

Use:
```sql
revoke select on table public.sellers from anon, authenticated;
grant select (id,owner_id,business_name,slug,location,description,verified_at,seller_type,business_kind)
  on table public.sellers to anon, authenticated;

create or replace function public.get_own_seller_profile_private()
returns table(
  id uuid,
  owner_id uuid,
  business_name text,
  slug text,
  location text,
  postcode text,
  description text,
  verified_at timestamptz,
  seller_type text,
  business_kind text
)
language sql
stable
security definer
set search_path=''
as $$
  select s.id,s.owner_id,s.business_name,s.slug,s.location,s.postcode,s.description,s.verified_at,s.seller_type,s.business_kind
  from public.sellers s
  where s.owner_id=(select auth.uid())
    and s.account_deleted_at is null
  limit 1;
$$;

revoke all on function public.get_own_seller_profile_private() from public;
revoke all on function public.get_own_seller_profile_private() from anon;
grant execute on function public.get_own_seller_profile_private() to authenticated;
```

Do not change service-role privileges or seller INSERT/UPDATE grants.

- [ ] **Step 4: Re-run the focused test**

Expected: DB-contract assertions pass; application leak assertions remain RED until Tasks 2–3.

- [ ] **Step 5: Commit**

Commit message: `security: restrict public seller private fields`

---

### Task 2: Separate public and owner seller reads

**Files:**
- Modify: `src/lib/data/marketplace.ts`
- Modify: `src/lib/types.ts` only if generated/static typing requires it.

**Interfaces:**
- Consumes: `get_own_seller_profile_private()`.
- Produces: public listing/seller objects with `postcode:null`.
- Preserves: `getSellerForOwner(ownerId): Promise<Seller|null>` returning the caller's own postcode.

- [ ] **Step 1: Remove postcode from public seller projections**

Update all `sellers!inner(...)` listing projections and `getSellerBySlug`/public seller selectors to omit `postcode`.

- [ ] **Step 2: Split mapping responsibilities**

Use a public seller row shape without postcode and map public `Seller` values with `postcode:null`. Keep an owner/private row shape for the RPC response.

- [ ] **Step 3: Move `getSellerForOwner()` to the owner-only RPC**

Call:
```ts
const {data,error}=await supabase.rpc("get_own_seller_profile_private");
```
Reject/error to `null` using the existing safe behavior, and map the first/only row to `Seller`.

- [ ] **Step 4: Run focused test + typecheck**

Run:
```bash
node --test scripts/test-public-seller-data-contract.mjs
npm run typecheck
```
Expected: public projection/owner assertions move toward GREEN with no type regression.

- [ ] **Step 5: Commit**

Commit message: `security: separate public and owner seller reads`

---

### Task 3: Sanitize public UI and mobile JSON

**Files:**
- Create: `src/lib/public-listing.ts`
- Modify: `src/app/seller/[slug]/page.tsx`
- Modify: `src/app/api/mobile/v1/marketplace/route.ts`
- Modify: `src/app/api/mobile/v1/listings/[slug]/route.ts`
- Modify: `src/app/api/mobile/v1/seller/profile/route.ts`

**Interfaces:**
- Produces: `toPublicListing(listing: Listing): Listing` with `seller.postcode:null`.
- Consumes: `get_own_seller_profile_private()` in the authenticated mobile seller-profile GET.

- [ ] **Step 1: Add defensive serializer**

Create:
```ts
import type { Listing } from "@/lib/types";
export const toPublicListing=(listing:Listing):Listing=>({
 ...listing,
 seller:{...listing.seller,postcode:null}
});
```

- [ ] **Step 2: Remove postcode from public seller page**

Render only `seller.location` beside the map pin.

- [ ] **Step 3: Sanitize public mobile marketplace payloads**

Call `toPublicListing(item)` before adding mobile thumbnail URLs in marketplace results and listing detail.

- [ ] **Step 4: Move mobile seller profile GET to owner RPC**

Use `supabase.rpc("get_own_seller_profile_private")` instead of direct `.from("sellers").select(...postcode...)`.

- [ ] **Step 5: Stop PATCH from selecting private postcode**

Return only approved public columns from the update query, then set response `postcode:sellerGeo.postcode` after the successful update.

- [ ] **Step 6: Run the focused test**

Run: `node --test scripts/test-public-seller-data-contract.mjs`
Expected: all seller data-boundary tests PASS.

- [ ] **Step 7: Commit**

Commit message: `security: sanitize public seller responses`

---

### Task 4: Sync Supabase types and repository contract

**Files:**
- Modify: `src/lib/supabase/database.types.ts`

**Interfaces:**
- Adds generated-equivalent function typing for `get_own_seller_profile_private`.

- [ ] **Step 1: Add the RPC signature matching the migration**

Ensure `Args: Record<PropertyKey, never>` (or repository-equivalent no-arg shape) and row fields exactly match the SQL return table.

- [ ] **Step 2: Run typecheck and full unit suite**

Run:
```bash
npm run typecheck
npm test
```
Expected: PASS.

- [ ] **Step 3: Commit**

Commit message: `types: add private seller profile rpc`

---

### Task 5: Deploy and verify the QA database boundary

**Files:**
- No additional product files unless readback exposes a defect.

**Interfaces:**
- QA project: `etkupijfdznljimrfyct`.

- [ ] **Step 1: Apply migration to QA**

Apply `public_seller_data_boundary` using the exact migration SQL committed in Task 1.

- [ ] **Step 2: Read back privileges**

Verify:
- no table-level `SELECT` for `anon` or `authenticated` on `public.sellers`;
- approved column-level SELECT privileges exist;
- no SELECT privilege exists on postcode/geocoding/deletion columns;
- service role retains full access.

- [ ] **Step 3: Read back RPC**

Verify `security_definer=true`, empty search path, `auth.uid()` ownership predicate, no anon execute and authenticated execute enabled.

- [ ] **Step 4: Non-destructive behavior check**

Do not modify seller rows. Read only metadata/grants/function definition.

---

### Task 6: Full verification and Preview

**Files:**
- Update evidence documentation only after code/DB verification is green.

- [ ] **Step 1: Run full GitHub Actions on final SHA**

Required green jobs:
- `validate`
- `last-stock-concurrency`
- `marketplace-scale-postgres`

- [ ] **Step 2: Confirm full gates**

Require fresh PASS for lint, typecheck, `npm test`, all validators and Next.js build.

- [ ] **Step 3: Confirm Vercel exact-SHA Preview**

The deployment for the final commit SHA must be `READY`. Do not rely on the stale manual alias.

- [ ] **Step 4: Record evidence**

Document the exact SHA, CI run, QA migration version/readback and remaining external gates. Do not claim provider/device tests from this change.
