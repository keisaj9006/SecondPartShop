import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const signatures={
 claim_account_deletion_request:'claim_account_deletion_request(uuid)',
 garage_respond_fitting_request:'garage_respond_fitting_request(uuid,text,integer,text)',
 prepare_checkout_order:'prepare_checkout_order(uuid,integer,text)',
 request_part_fitting_quote:'request_part_fitting_quote(uuid,uuid,uuid,smallint,text,integer,text,text)',
 send_fitting_request_message:'send_fitting_request_message(uuid,text)',
};
const digest=(algorithm,text)=>createHash(algorithm).update(text,'utf8').digest('hex');
export function validateDeployedDeletionFunctions(snapshot){
 assert.equal(snapshot.project_id,'etkupijfdznljimrfyct');
 assert.equal(snapshot.functions.length,5);
 assert.equal(new Set(snapshot.functions.map(row=>row.proname)).size,5);
 const functions=snapshot.functions.map(row=>{
  assert.ok(Object.hasOwn(signatures,row.proname));assert.equal(row.signature,signatures[row.proname]);
  assert.equal(row.owner,'postgres');assert.equal(row.security_definer,true);
  assert.deepEqual(row.proconfig,['search_path=""']);assert.match(row.server_version,/^17\./);
  const roles=row.proname==='claim_account_deletion_request'?['service_role']:['authenticated','service_role'];
  assert.equal(row.acl,'{postgres=X/postgres,'+roles.map(role=>role+'=X/postgres').join(',')+'}');
  assert.ok(row.definition.startsWith('CREATE OR REPLACE FUNCTION public.'+row.proname+'('));
  assert.equal(digest('md5',row.definition),row.definition_md5,'Exported definition differs from hosted readback hash');
  return {...row,roles,definition_sha256:digest('sha256',row.definition)};
 });
 return {...snapshot,functions};
}
export async function loadDeployedDeletionFunctions(db,snapshot){
 const verified=validateDeployedDeletionFunctions(snapshot);
 for(const row of verified.functions){
  // Preserve the exported definition byte-for-byte; never splice proposal SQL.
  await db.exec(row.definition);
  await db.exec(`revoke all on function public.${row.signature} from public,anon,authenticated,service_role;
   grant execute on function public.${row.signature} to ${row.roles.join(',')};`);
 }
 await verifyDeployedDeletionFunctions(db,verified);
 return verified;
}
export async function verifyDeployedDeletionFunctions(db,snapshot){
 for(const expected of snapshot.functions){
  const {rows}=await db.query(`select pg_get_functiondef(p.oid) definition,p.proacl::text acl,
   pg_get_userbyid(p.proowner) owner from pg_proc p where p.oid=$1::regprocedure`,['public.'+expected.signature]);
  assert.equal(rows.length,1);assert.equal(rows[0].definition,expected.definition,'Loaded PostgreSQL function differs from exact hosted export');
  assert.equal(rows[0].acl,expected.acl);assert.equal(rows[0].owner,expected.owner);
 }
}
