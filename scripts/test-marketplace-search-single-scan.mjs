import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath="supabase/migrations/20260914103500_single_scan_marketplace_search_candidates.sql";

test("marketplace search keeps the complete candidate set in one eligible scan",()=>{
 assert.equal(fs.existsSync(migrationPath),true,"single-scan marketplace search migration must exist");
 const source=fs.readFileSync(migrationPath,"utf8");
 assert.match(source,/create or replace function public\.marketplace_search_page_v1\(/i);
 const start=source.indexOf("candidate_ids as (");
 const end=source.indexOf("),\n documents as (",start);
 assert.ok(start>=0&&end>start,"candidate_ids CTE must be present");
 const candidateCte=source.slice(start,end);
 assert.match(candidateCte,/select p\.id from eligible p cross join prepared_query q/i);
 assert.match(candidateCte,/p\.search_document@@q\.ts_query/i);
 assert.match(candidateCte,/lower\(p\.title\) like/i);
 assert.match(candidateCte,/p\.oem_number is not null/i);
 assert.match(candidateCte,/p\.part_number is not null/i);
 assert.match(candidateCte,/p\.gearbox_code is not null/i);
 assert.match(candidateCte,/p\.gearbox_family is not null/i);
 assert.match(candidateCte,/p\.category_id in/i);
 assert.doesNotMatch(candidateCte,/\bunion\b/i,"candidate discovery must not rescan eligible through UNION branches");
});
