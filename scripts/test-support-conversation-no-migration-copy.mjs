import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationDir="supabase/migrations";
const sql=fs.readdirSync(migrationDir).filter(name=>name.endsWith(".sql")).map(name=>fs.readFileSync(`${migrationDir}/${name}`,"utf8")).join("\n");

test("support thread migration does not duplicate legacy support request messages",()=>{
 assert.doesNotMatch(sql,/insert\s+into\s+public\.support_request_messages[\s\S]{0,400}select[\s\S]{0,400}from\s+public\.support_requests/i);
});
