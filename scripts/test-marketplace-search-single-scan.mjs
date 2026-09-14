import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath="supabase/migrations/20260914103500_single_scan_marketplace_search_candidates.sql";

test("marketplace search keeps the complete candidate set in one fail-closed eligible scan",()=>{
 assert.equal(fs.existsSync(migrationPath),true,"single-scan marketplace search migration must exist");
 const source=fs.readFileSync(migrationPath,"utf8");
 assert.match(source,/to_regprocedure\('public\.marketplace_search_page_v1\(/i,"patch must bind the exact RPC signature");
 assert.match(source,/pg_get_functiondef\(target\)/i,"patch must inspect the deployed function definition");
 assert.match(source,/occurrences\s*<>\s*1/i,"definition drift must fail closed");
 assert.match(source,/execute\s+optimized/i,"patch must execute only the verified replacement definition");

 const marker="replacement text := $patch$";
 const start=source.indexOf(marker);
 const end=source.indexOf("$patch$;",start+marker.length);
 assert.ok(start>=0&&end>start,"single-scan replacement block must be explicit in the migration");
 const candidateCte=source.slice(start+marker.length,end);
 assert.match(candidateCte,/candidate_ids as \(/i);
 assert.match(candidateCte,/select\s+p\.id\s+from\s+eligible\s+p\s+cross\s+join\s+prepared_query\s+q/i);
 assert.match(candidateCte,/p\.search_document@@q\.ts_query/i);
 assert.match(candidateCte,/lower\(p\.title\) like/i);
 assert.match(candidateCte,/p\.oem_number is not null/i);
 assert.match(candidateCte,/p\.part_number is not null/i);
 assert.match(candidateCte,/p\.gearbox_code is not null/i);
 assert.match(candidateCte,/p\.gearbox_family is not null/i);
 assert.match(candidateCte,/p\.category_id in/i);
 assert.doesNotMatch(candidateCte,/\bunion\b/i,"candidate discovery must not rescan eligible through UNION branches");

 assert.match(source,/alter function public\.marketplace_search_page_v1[\s\S]*security definer/i);
 assert.match(source,/alter function public\.marketplace_search_page_v1[\s\S]*set search_path\s*=\s*''/i);
 assert.match(source,/grant execute on function public\.marketplace_search_page_v1[\s\S]*to anon,authenticated/i);
 assert.match(source,/grant execute on function public\.marketplace_search_page_v1[\s\S]*to service_role/i);
});
