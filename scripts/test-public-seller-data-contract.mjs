import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(relative)=>fs.readFileSync(path.join(root,relative),"utf8");
const migrationPath="supabase/migrations/20260913160500_public_seller_data_boundary.sql";

test("public seller profile does not render the seller postcode",()=>{
 const source=read("src/app/seller/[slug]/page.tsx");
 assert.doesNotMatch(source,/seller\.postcode/);
});

test("public listing projections do not request seller postcode",()=>{
 const source=read("src/lib/data/marketplace.ts");
 const publicListingSelects=[...source.matchAll(/sellers!inner\(([^)]+)\)/g)].map(match=>match[1]);
 assert.ok(publicListingSelects.length>=3,"expected marketplace listing seller projections");
 for(const projection of publicListingSelects){
  assert.doesNotMatch(projection,/(^|,)postcode(,|$)/,"public listing seller projection must not select postcode");
 }
});

test("mobile marketplace strips private seller fields before serializing listings",()=>{
 const source=read("src/app/api/mobile/v1/marketplace/route.ts");
 assert.match(source,/toPublicListing/);
 assert.doesNotMatch(source,/items:result\.data\.map\(item=>\(\{\.\.\.item,/);
});

test("mobile listing detail strips private seller fields before serializing the item",()=>{
 const source=read("src/app/api/mobile/v1/listings/[slug]/route.ts");
 assert.match(source,/toPublicListing/);
 assert.doesNotMatch(source,/const item=\{\.\.\.result\.data,/);
});

test("seller read grants expose only the approved public column whitelist",()=>{
 const migration=read(migrationPath);
 assert.match(migration,/revoke select on table public\.sellers from anon,\s*authenticated;/i);
 const grant=migration.match(/grant select \(([^)]+)\)\s*on table public\.sellers to anon,\s*authenticated;/i);
 assert.ok(grant,"expected explicit public seller column grant");
 const columns=grant[1].split(",").map(value=>value.trim()).filter(Boolean).sort();
 assert.deepEqual(columns,[
  "business_kind","business_name","description","id","location","owner_id","seller_type","slug","verified_at"
 ].sort());
 for(const privateColumn of ["postcode","latitude","longitude","postcode_geocode_approximate","postcode_geocoded_at","account_deleted_at"]){
  assert.ok(!columns.includes(privateColumn),`${privateColumn} must not be publicly selectable`);
 }
});

test("private seller profile rpc is authenticated-only and ownership-bound",()=>{
 const migration=read(migrationPath);
 assert.match(migration,/create or replace function public\.get_own_seller_profile_private\(\)/i);
 assert.match(migration,/security definer/i);
 assert.match(migration,/set search_path\s*=\s*''/i);
 assert.match(migration,/s\.owner_id\s*=\s*\(select auth\.uid\(\)\)/i);
 assert.match(migration,/s\.account_deleted_at is null/i);
 assert.match(migration,/revoke all on function public\.get_own_seller_profile_private\(\) from public;/i);
 assert.match(migration,/revoke all on function public\.get_own_seller_profile_private\(\) from anon;/i);
 assert.match(migration,/grant execute on function public\.get_own_seller_profile_private\(\) to authenticated;/i);
});

test("owner seller lookup uses the authenticated private seller rpc",()=>{
 const source=read("src/lib/data/marketplace.ts");
 assert.match(source,/getSellerForOwner[\s\S]*?rpc\("get_own_seller_profile_private"\)/);
});
