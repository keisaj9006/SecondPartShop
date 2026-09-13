import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(relative)=>fs.readFileSync(path.join(root,relative),"utf8");

test("public seller profile does not render the seller postcode",()=>{
 const source=read("src/app/seller/[slug]/page.tsx");
 assert.doesNotMatch(source,/seller\.postcode/);
});

test("public listing projections do not request seller postcode",()=>{
 const source=read("src/lib/data/marketplace.ts");
 const publicListingSelects=[...source.matchAll(/sellers!inner\(([^)]]+)\)/g)].map(match=>match[1]);
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

test("owner seller lookup still requests postcode for private account workflows",()=>{
 const source=read("src/lib/data/marketplace.ts");
 assert.match(source,/getSellerForOwner[\s\S]*?select\("id,owner_id,business_name,slug,location,postcode,description,verified_at,seller_type,business_kind"\)/);
});
