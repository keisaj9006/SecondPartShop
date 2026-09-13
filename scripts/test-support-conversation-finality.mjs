import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationDir="supabase/migrations";
const sql=fs.readdirSync(migrationDir).filter(name=>name.endsWith(".sql")).map(name=>fs.readFileSync(`${migrationDir}/${name}`,"utf8")).join("\n");

test("closed support requests remain final in user and admin reply RPCs",()=>{
 assert.match(sql,/reply_to_support_request[\s\S]*status[^\n]*closed[\s\S]*raise exception/i);
 assert.match(sql,/admin_reply_to_support_request[\s\S]*status[^\n]*closed[\s\S]*raise exception/i);
});
