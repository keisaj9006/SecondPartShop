import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationDir="supabase/migrations";
const sql=fs.readdirSync(migrationDir).filter(name=>name.endsWith(".sql")).map(name=>fs.readFileSync(`${migrationDir}/${name}`,"utf8")).join("\n");

test("support thread uses atomic reply RPCs with explicit grants",()=>{
 assert.match(sql,/create or replace function public\.reply_to_support_request/i);
 assert.match(sql,/create or replace function public\.admin_reply_to_support_request/i);
 assert.match(sql,/security definer/i);
 assert.match(sql,/set search_path\s*=\s*''/i);
 assert.match(sql,/revoke all on function public\.reply_to_support_request/i);
 assert.match(sql,/grant execute on function public\.reply_to_support_request[^;]*authenticated/i);
 assert.match(sql,/revoke all on function public\.admin_reply_to_support_request/i);
 assert.doesNotMatch(sql,/grant execute on function public\.admin_reply_to_support_request[^;]*anon/i);
});

test("user reply RPC enforces owner identity and bounded message length",()=>{
 assert.match(sql,/profile_id\s*=\s*\(select auth\.uid\(\)\)/i);
 assert.match(sql,/char_length\([^)]*message[^)]*\)\s*(?:<|between)/i);
 assert.match(sql,/2000/i);
});

test("admin reply RPC explicitly verifies admin authority",()=>{
 assert.match(sql,/admin_reply_to_support_request[\s\S]*is_admin/i);
});
