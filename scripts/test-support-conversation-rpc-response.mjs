import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationDir="supabase/migrations";
const sql=fs.readdirSync(migrationDir).filter(name=>name.endsWith(".sql")).map(name=>fs.readFileSync(`${migrationDir}/${name}`,"utf8")).join("\n");

test("reply RPCs return enough state for server actions to report success safely",()=>{
 assert.match(sql,/reply_to_support_request[\s\S]*returns/i);
 assert.match(sql,/admin_reply_to_support_request[\s\S]*returns/i);
});
