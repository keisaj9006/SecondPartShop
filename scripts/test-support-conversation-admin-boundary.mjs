import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationDir="supabase/migrations";
const sql=fs.readdirSync(migrationDir).filter(name=>name.endsWith(".sql")).map(name=>fs.readFileSync(`${migrationDir}/${name}`,"utf8")).join("\n");

test("support messages are not publicly readable or writable",()=>{
 assert.doesNotMatch(sql,/grant\s+select[^;]*support_request_messages[^;]*anon/i);
 assert.doesNotMatch(sql,/grant\s+insert[^;]*support_request_messages[^;]*anon/i);
 assert.doesNotMatch(sql,/grant\s+(?:update|delete)[^;]*support_request_messages/i);
});

test("admin reply path does not expose admin notes to the customer thread",()=>{
 const adminActions=fs.readFileSync("src/app/admin/moderation/actions.ts","utf8");
 const userPage=fs.existsSync("src/app/contact/[requestId]/page.tsx")?fs.readFileSync("src/app/contact/[requestId]/page.tsx","utf8"):"";
 assert.doesNotMatch(adminActions,/admin_notes[^\n]*support_request_messages/i);
 assert.doesNotMatch(userPage,/admin_notes/i);
});
