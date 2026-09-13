import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationsDir=path.join(process.cwd(),"supabase","migrations");
const migrationSql=fs.readdirSync(migrationsDir)
 .filter(name=>name.endsWith(".sql"))
 .sort()
 .map(name=>fs.readFileSync(path.join(migrationsDir,name),"utf8"))
 .join("\n");

const compact=value=>value.replace(/\s+/g," ").trim();
const sql=compact(migrationSql);

test("support conversation sender foreign keys have covering indexes",()=>{
 assert.match(
  sql,
  /create index(?: if not exists)? support_request_messages_sender_profile_idx on public\.support_request_messages\s*\(\s*sender_profile_id\s*\)/i,
  "support_request_messages.sender_profile_id needs a covering index for profile FK operations."
 );
 assert.match(
  sql,
  /create index(?: if not exists)? support_request_internal_notes_admin_profile_idx on public\.support_request_internal_notes\s*\(\s*admin_profile_id\s*\)/i,
  "support_request_internal_notes.admin_profile_id needs a covering index for profile FK operations."
 );
});
