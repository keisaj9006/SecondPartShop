import fs from "node:fs";

const migration=fs.readFileSync("supabase/migrations/20260911090000_consolidate_seller_read_policy.sql","utf8");

const checks=[
 [
  "Anonymous seller reads must remain limited to non-deleted profiles",
  migration.includes('create policy "sellers public read"')&&
  migration.includes("to anon")&&
  migration.includes("using (account_deleted_at is null)")
 ],
 [
  "Authenticated seller reads must use one consolidated policy",
  migration.includes('create policy "sellers authenticated read"')&&
  migration.includes("to authenticated")&&
  migration.includes("account_deleted_at is null or private.is_admin()")
 ],
 [
  "Legacy overlapping authenticated policies must be removed",
  migration.includes('drop policy if exists "sellers public read"')&&
  migration.includes('drop policy if exists "sellers admin deleted read"')
 ]
];

let failed=0;
for(const [name,ok] of checks){
 console.log(`${ok?"PASS":"FAIL"}: ${name}`);
 if(!ok)failed++;
}

if(failed){
 console.error(`\n${failed} seller read-policy invariant(s) failed.`);
 process.exit(1);
}

console.log("\nSeller read-policy consolidation guard passed.");
