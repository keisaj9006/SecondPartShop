import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const migrationPath=path.join(root,"supabase/migrations/20260916144500_restrict_seller_checkout_ready_anon.sql");

test("seller_checkout_ready is not directly executable by anonymous callers",()=>{
 assert.equal(fs.existsSync(migrationPath),true,"Expected grant-hardening migration to exist");
 const sql=fs.readFileSync(migrationPath,"utf8").toLowerCase().replace(/\s+/g," ");
 assert.match(sql,/revoke execute on function public\.seller_checkout_ready\(uuid\) from public\s*,\s*anon|revoke execute on function public\.seller_checkout_ready\(uuid\) from anon/);
 assert.match(sql,/grant execute on function public\.seller_checkout_ready\(uuid\) to authenticated/);
 assert.match(sql,/grant execute on function public\.seller_checkout_ready\(uuid\) to service_role/);
});
