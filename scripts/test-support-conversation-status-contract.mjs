import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationDir="supabase/migrations";
const sql=fs.readdirSync(migrationDir).filter(name=>name.endsWith(".sql")).map(name=>fs.readFileSync(`${migrationDir}/${name}`,"utf8")).join("\n");

test("support requests allow resolved state without weakening the existing status check",()=>{
 assert.match(sql,/support_requests[\s\S]*status[\s\S]*open[\s\S]*in_progress[\s\S]*resolved[\s\S]*closed/i);
});

test("user replies reopen resolved requests atomically",()=>{
 assert.match(sql,/reply_to_support_request[\s\S]*resolved[\s\S]*update public\.support_requests[\s\S]*status\s*=\s*'open'/i);
});

test("closed requests reject further visible replies",()=>{
 assert.match(sql,/reply_to_support_request[\s\S]*closed[\s\S]*raise exception/i);
 assert.match(sql,/admin_reply_to_support_request[\s\S]*closed[\s\S]*raise exception/i);
});
