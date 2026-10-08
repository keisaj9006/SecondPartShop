import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import * as loader from './deployed-deletion-functions.mjs';
const snapshot=()=>JSON.parse(fs.readFileSync('docs/test-runs/2026-10-08-deployed-deletion-functions.json','utf8'));
test('deployed export validates five exact bodies and known signatures/ACLs',()=>{
 assert.equal(typeof loader.validateDeployedDeletionFunctions,'function','exact deployed export validator required');
 const result=loader.validateDeployedDeletionFunctions(snapshot());assert.equal(result.functions.length,5);
 for(const row of result.functions)assert.match(row.definition_sha256,/^[0-9a-f]{64}$/);
});
test('deployed export rejects altered bodies, incomplete exports and unexpected authority',()=>{
 assert.equal(typeof loader.validateDeployedDeletionFunctions,'function','exact deployed export validator required');
 for(const mutate of [x=>x.functions[0].definition+='-- changed',x=>x.functions.pop(),x=>x.functions.push(x.functions[0]),x=>x.functions[0].signature='wrong(uuid)',x=>x.functions[0].acl='{=X/postgres}',x=>x.functions[0].owner='authenticated',x=>x.project_id='wrong']){
  const data=snapshot();mutate(data);assert.throws(()=>loader.validateDeployedDeletionFunctions(data));
 }
});
test('exact deployed mode cannot silently run a local candidate or non-PG17 substitute',()=>{
 const result=spawnSync(process.execPath,['scripts/test-account-deletion-checkout-race.mjs','--deployed'],{encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/deployed.*requires.*postgres/i);
});
