import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow=fs.readFileSync(".github/workflows/rebuild-nextjs-qa.yml","utf8");
const verifierPath="scripts/verify-marketplace-scale-postgres.mjs";

test("QA includes an isolated PostgreSQL 17 marketplace scale job",()=>{
 assert.match(workflow,/marketplace-scale-postgres:/);
 assert.match(workflow,/image:\s*postgres:17/);
 assert.match(workflow,/verify-marketplace-scale-postgres\.mjs/);
 assert.match(workflow,/TEST_DATABASE_URL/);
});

test("native scale verifier uses the exact current migration and 25,000 isolated listings",()=>{
 assert.equal(fs.existsSync(verifierPath),true,"native PostgreSQL scale verifier must exist");
 const source=fs.readFileSync(verifierPath,"utf8");
 assert.match(source,/25_000/);
 assert.match(source,/20260912110440_complete_marketplace_search_page\.sql/);
 assert.match(source,/TEST_DATABASE_URL/);
 assert.match(source,/psql/);
 for(const scenario of [
  "filtered_compact_oem",
  "best_first_page",
  "price_desc_clamped_page",
  "price_asc_deep_page",
  "price_desc_deep_page",
  "best_terminal_page"
 ])assert.match(source,new RegExp(scenario));
 assert.doesNotMatch(source,/NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE|etkupijfdznljimrfyct/);
});