import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const migrationPath="supabase/migrations/20260913222000_deleted_seller_marketplace_rpc_guard.sql";
const migrationFile=path.join(root,migrationPath);

const signatures=[
 "marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid)",
 "marketplace_catalogue_cursor_page_v1(uuid,smallint,text,integer,uuid[],text,integer,integer,boolean,boolean,integer,timestamptz,uuid,integer)",
 "marketplace_catalogue_distance_page(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer)",
 "marketplace_catalogue_distance_page_v2(uuid,smallint,double precision,double precision,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer)",
 "marketplace_catalogue_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,integer,integer)",
 "marketplace_catalogue_sorted_page(uuid,smallint,text,integer,uuid[],uuid[],text,integer,integer,boolean,boolean,text,integer,integer)",
 "marketplace_distance_page(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer)",
 "marketplace_distance_page_v2(double precision,double precision,uuid[],uuid[],text,integer,integer,boolean,integer,integer)"
];

test("all public marketplace SECURITY DEFINER part-id RPCs get a deleted-seller guard",()=>{
 assert.ok(fs.existsSync(migrationFile),"expected marketplace deleted-seller guard migration");
 const migration=fs.readFileSync(migrationFile,"utf8");
 for(const signature of signatures){
  assert.ok(migration.includes(signature),`missing hardening entry for ${signature}`);
 }
 assert.ok((migration.match(/account_deleted_at is null/gi)??[]).length>=8,"expected a deleted-account predicate for every public marketplace RPC");
});

test("marketplace RPC hardening is fail-closed and preserves public execution contracts",()=>{
 assert.ok(fs.existsSync(migrationFile),"expected marketplace deleted-seller guard migration");
 const migration=fs.readFileSync(migrationFile,"utf8");
 assert.match(migration,/pg_get_functiondef/i);
 assert.match(migration,/if hardened is not distinct from original then[\s\S]*?raise exception/i);
 assert.match(migration,/security definer/i);
 assert.match(migration,/set search_path\s*=\s*''/i);
 for(const name of [
  "marketplace_catalogue_compatibility",
  "marketplace_catalogue_cursor_page_v1",
  "marketplace_catalogue_distance_page",
  "marketplace_catalogue_distance_page_v2",
  "marketplace_catalogue_page",
  "marketplace_catalogue_sorted_page",
  "marketplace_distance_page",
  "marketplace_distance_page_v2"
 ]){
  assert.match(migration,new RegExp(`grant execute on function public\\.${name}\\(`,"i"));
 }
});
