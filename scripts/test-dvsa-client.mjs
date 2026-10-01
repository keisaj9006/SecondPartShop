import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const fixture={registration:'AB12CDE',make:'FORD',model:'FOCUS',manufactureDate:'2012-01-01',firstUsedDate:'2013-02-01',engineSize:'1596',fuelType:'Petrol',primaryColour:'Blue',motTests:[{privateUpstream:'unused'}]};
function client({status=200,vehicle=fixture,tokenStatus=200,expires=3600,network=false}={}){
 const calls=[]; let now=1000000;
 const env={DVSA_CLIENT_ID:'synthetic-client',DVSA_CLIENT_SECRET:'synthetic-secret',DVSA_API_KEY:'synthetic-key',DVSA_SCOPE_URL:'https://tapi.dvsa.gov.uk/.default',DVSA_TOKEN_URL:'https://login.microsoftonline.com/test/oauth2/v2.0/token'};
 const exports={};
 const source=ts.transpileModule(fs.readFileSync('src/lib/vehicle-registration.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,process:{env},URL,URLSearchParams,AbortSignal,Date:class extends Date{static now(){return now;}},
  require(name){if(name==='server-only')return {};if(name==='@/lib/vehicle-lookup-operational')return {getCachedRegistrationLookup:async()=>null,storeRegistrationLookup:async()=>{}};throw Error(name);},
  fetch:async(url,options)=>{calls.push({url,options});if(network)throw Error('synthetic-secret synthetic-key');return options.method==='POST'?new Response(JSON.stringify({access_token:'synthetic-token',expires_in:expires}),{status:tokenStatus}):new Response(JSON.stringify(vehicle),{status});}
 });
 return {env,lookup:exports.lookupVehicleByRegistration,normalize:exports.normalizeRegistration,plausible:exports.isPlausibleUkRegistration,calls,advance:ms=>{now+=ms;}};
}
test('DVSA normalizes whitespace without silently removing punctuation or truncating input',()=>{
 const c=client();assert.equal(c.normalize(' ab12 cde '),'AB12CDE');assert.equal(c.plausible('AB12!CDE'),false);assert.equal(c.plausible('AB123456789'),false);
});
test('DVSA uses canonical server credentials and returns only documented vehicle fields',async()=>{
 const c=client();const result=await c.lookup('ab12 cde');assert.equal(result.status,'found');assert.equal(result.vehicle.year,2012);assert.equal(result.vehicle.engineSizeSimple,1596);
 assert.equal(c.calls.length,2);assert.equal(c.calls[1].options.headers['X-API-Key'],'synthetic-key');assert.equal(c.calls[1].options.headers.Authorization,'Bearer synthetic-token');assert.ok(c.calls.every(call=>call.options.signal));
 assert.doesNotMatch(JSON.stringify(result),/synthetic-|motTests|privateUpstream/);
});
test('DVSA reuses token then refreshes before its actual expiry',async()=>{
 const c=client({expires:120});await c.lookup('AB12CDE');await c.lookup('CD34EFG');assert.equal(c.calls.filter(x=>x.options.method==='POST').length,1);c.advance(121000);await c.lookup('EF56GHI');assert.equal(c.calls.filter(x=>x.options.method==='POST').length,2);
});
test('invalid registration makes no upstream calls',async()=>{const c=client();await c.lookup('AB12!CDE');assert.equal(c.calls.length,0);});
test('blank canonical variables preserve legacy configured credentials',async()=>{
 const c=client();for(const [canonical,legacy] of [['DVSA_CLIENT_ID','DVSA_MOT_CLIENT_ID'],['DVSA_CLIENT_SECRET','DVSA_MOT_CLIENT_SECRET'],['DVSA_API_KEY','DVSA_MOT_API_KEY'],['DVSA_SCOPE_URL','DVSA_MOT_SCOPE'],['DVSA_TOKEN_URL','DVSA_MOT_TOKEN_URL']]){c.env[legacy]=c.env[canonical];c.env[canonical]=' ';}
 assert.equal((await c.lookup('AB12CDE')).status,'found');assert.equal(c.calls.length,2);
});
test('concurrent lookups share one token acquisition',async()=>{
 const c=client();await Promise.all([c.lookup('AB12CDE'),c.lookup('AB12CDE')]);assert.equal(c.calls.filter(x=>x.options.method==='POST').length,1);
});
test('malformed optional DVSA dates do not create a year or first-use date',async()=>{
 const c=client({vehicle:{...fixture,manufactureDate:'2012garbage',registrationDate:'2012-99-99',firstUsedDate:'2012-02-31'}});const r=await c.lookup('AB12CDE');assert.equal(r.status,'found');assert.equal(r.vehicle.year,undefined);assert.equal(r.vehicle.firstUsedDate,undefined);
});
for(const status of [401,403,429,500,503])test(`DVSA ${status} returns a sanitized unavailable result`,async()=>{const c=client({status});const r=await c.lookup('AB12CDE');assert.equal(r.status,'unavailable');assert.doesNotMatch(JSON.stringify(r),/synthetic-/);});
test('DVSA 404 returns not found',async()=>{assert.equal((await client({status:404}).lookup('AB12CDE')).status,'not_found');});
test('token failure is sanitized',async()=>{assert.equal((await client({tokenStatus:401}).lookup('AB12CDE')).status,'unavailable');});
test('network failure is sanitized',async()=>{const r=await client({network:true}).lookup('AB12CDE');assert.equal(r.status,'unavailable');assert.doesNotMatch(JSON.stringify(r),/synthetic-/);});
for(const vehicle of [null,[],{}, {...fixture,registration:'ZZ99ZZZ'}])test(`malformed or mismatched DVSA record ${JSON.stringify(vehicle)} fails closed`,async()=>{assert.equal((await client({vehicle}).lookup('AB12CDE')).status,'unavailable');});
