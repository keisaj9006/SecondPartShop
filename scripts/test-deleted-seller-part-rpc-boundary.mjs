import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const migrationPath="supabase/migrations/20260913194500_deleted_seller_part_rpc_guard.sql";
const migrationFile=path.join(root,migrationPath);

test("part passport evidence requires an active part owned by a non-deleted seller",()=>{
 assert.ok(fs.existsSync(migrationFile),"expected deleted-seller part RPC guard migration");
 const migration=fs.readFileSync(migrationFile,"utf8");
 assert.match(migration,/create or replace function public\.get_part_passport_evidence\(p_part_id uuid\)/i);
 assert.match(migration,/from public\.parts p\s+join public\.sellers s on s\.id=p\.seller_id/i);
 assert.match(migration,/p\.id=p_part_id[\s\S]*?p\.status='active'::public\.listing_status[\s\S]*?s\.account_deleted_at is null/i);
 assert.match(migration,/revoke all on function public\.get_part_passport_evidence\(uuid\) from public;/i);
 assert.match(migration,/grant execute on function public\.get_part_passport_evidence\(uuid\) to anon,authenticated;/i);
});

test("verified fit summary returns no retained aggregate for a deleted seller part",()=>{
 assert.ok(fs.existsSync(migrationFile),"expected deleted-seller part RPC guard migration");
 const migration=fs.readFileSync(migrationFile,"utf8");
 assert.match(migration,/create or replace function public\.get_part_verified_fit_summary\(\s*p_part_id uuid,\s*p_variant_id uuid,/i);
 assert.match(migration,/exists\(\s*select 1\s+from public\.parts p\s+join public\.sellers s on s\.id=p\.seller_id\s+where p\.id=p_part_id\s+and p\.status='active'::public\.listing_status\s+and s\.account_deleted_at is null\s*\)/i);
 assert.match(migration,/revoke all on function public\.get_part_verified_fit_summary\(uuid,uuid,smallint,text,integer\) from public;/i);
 assert.match(migration,/grant execute on function public\.get_part_verified_fit_summary\(uuid,uuid,smallint,text,integer\) to anon,authenticated;/i);
});
