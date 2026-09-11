// Contract guard only. Real locking/RLS execution is covered by the disposable
// SQL QA protocol and remains an explicit deployment gate.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const sql=fs.readFileSync(new URL("../supabase/migrations/20260911213522_secure_part_image_cleanup.sql",import.meta.url),"utf8");
function body(name){const match=sql.match(new RegExp(`(?:create or replace|create) function (?:private|public)\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`));assert.ok(match,`Missing ${name}`);return match[1];}
test("cleanup authority stays private and all worker RPCs are service-only",()=>{
 assert.match(sql,/revoke all on private\.part_image_cleanup from public,anon,authenticated,service_role/);
 assert.doesNotMatch(sql,/references[^;]*on delete cascade/i);
 for(const name of ["queue_orphan_part_image_cleanup","get_part_image_cleanup_queue","complete_part_image_cleanup","fail_part_image_cleanup"]){
  assert.match(sql,new RegExp(`revoke all on function public\\.${name}\\([^;]*from public,anon,authenticated,service_role`));
  assert.match(sql,new RegExp(`grant execute on function public\\.${name}\\([^;]*to service_role`));
 }
 assert.doesNotMatch(sql,/(?:delete from|update|insert into) storage\.objects/i);
});
test("parent locks precede path locks and all retirement/reference checks",()=>{
 for(const name of ["guard_part_image_attachment","prevent_last_active_listing_image_delete","queue_orphan_part_image_cleanup","can_upload_part_image"]){
  const b=body(name);assert.ok(b.indexOf("for update of p")>=0);assert.ok(b.indexOf("for update of p")<b.indexOf("pg_advisory_xact_lock"));
  assert.ok(b.indexOf("pg_advisory_xact_lock")<b.indexOf("private.part_image_cleanup"));
 }
 const deletion=body("prevent_last_active_listing_image_delete");assert.ok(deletion.indexOf("for update of p")<deletion.indexOf("count(*)"));assert.match(deletion,/part_row.status='reserved'/);assert.match(deletion,/part_row.status='active'/);
 const attach=body("guard_part_image_attachment");assert.match(attach,/new.part_id is distinct from old.part_id/);assert.match(attach,/new.storage_path is distinct from old.storage_path/);
});
test("client Storage mutation is denied even if another permissive policy exists",()=>{
 assert.match(sql,/as restrictive for delete to authenticated\s+using\(bucket_id<>'part-images'\)/);
 assert.match(sql,/as restrictive for update to authenticated\s+using\(bucket_id<>'part-images'\) with check\(bucket_id<>'part-images'\)/);
 assert.match(sql,/as restrictive for insert to authenticated[\s\S]*private.can_upload_part_image\(name\)/);
});
test("privacy drains pending paths using retained identity context before erasing tombstones",()=>{
 const discovery=body("get_account_deletion_part_image_paths");assert.match(discovery,/q.completed_at is null/);assert.match(discovery,/r.target_profile_id/);assert.match(discovery,/r.cleanup_seller_ids/);
 const final=body("complete_account_deletion_request");assert.ok(final.indexOf("from auth.users")<final.indexOf("delete from private.part_image_cleanup"));assert.ok(final.indexOf("q.completed_at is null")<final.indexOf("delete from private.part_image_cleanup"));assert.match(final,/where q.completed_at is not null/);
});
test("authorized parent cascade captures exact cleanup context before parent disappears",()=>{
 const parent=body("queue_part_images_before_parent_delete");
 assert.match(sql,/before delete on public.parts\s+for each row execute function private.queue_part_images_before_parent_delete\(\)/);
 assert.match(parent,/old.status='reserved'/);
 assert.match(parent,/parent_owner is distinct from auth.uid\(\)/);
 assert.match(parent,/values\(image_row.storage_path,path_owner,old.seller_id,old.id\)/);
 const child=body("prevent_last_active_listing_image_delete");
 const missing=child.slice(child.indexOf("if part_row.id is null then"),child.indexOf("if part_row.id is null then")+1000);
 assert.match(missing,/q.storage_path=old.storage_path and q.part_id=old.part_id and q.completed_at is null/);
 assert.match(missing,/cleanup_owner is distinct from auth.uid\(\)/);
 assert.match(missing,/cleanup_owner is null then raise/);
});
