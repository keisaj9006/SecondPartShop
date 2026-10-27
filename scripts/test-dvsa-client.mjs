import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const fixture={registration:'AB12CDE',make:'FORD',model:'FOCUS',manufactureDate:'2012-01-01',firstUsedDate:'2013-02-01',engineSize:'1596',fuelType:'Petrol',primaryColour:'Blue',motTests:[{privateUpstream:'unused'}]};
function client({status=200,vehicle=fixture,tokenStatus=200,expires=3600,network=false}={}){
 const calls=[]; const logs=[]; let now=1000000;
 const env={DVSA_CLIENT_ID:'synthetic-client',DVSA_CLIENT_SECRET:'synthetic-secret',DVSA_API_KEY:'synthetic-key',DVSA_SCOPE_URL:'https://tapi.dvsa.gov.uk/.default',DVSA_TOKEN_URL:'https://login.microsoftonline.com/test/oauth2/v2.0/token'};
 const exports={};
 const source=ts.transpileModule(fs.readFileSync('src/lib/vehicle-registration.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,process:{env},URL,URLSearchParams,AbortSignal,Date:class extends Date{static now(){return now;}},console:{error:(...args)=>logs.push(args)},
  require(name){if(name==='server-only')return {};if(name==='node:crypto')return crypto;if(name==='@/lib/vehicle-lookup-operational')return {getCachedRegistrationLookup:async()=>null,storeRegistrationLookup:async()=>{}};throw Error(name);},
  fetch:async(url,options)=>{calls.push({url,options});if(network==='timeout'||(network==='api-timeout'&&options.method==='GET'))throw Object.assign(Error('synthetic-secret synthetic-key'),{name:'TimeoutError'});if(network===true)throw Error('synthetic-secret synthetic-key');return options.method==='POST'?new Response(JSON.stringify({access_token:'synthetic-token',expires_in:expires}),{status:tokenStatus}):new Response(JSON.stringify(vehicle),{status});}
 });
 return {env,lookup:exports.lookupVehicleByRegistration,normalize:exports.normalizeRegistration,plausible:exports.isPlausibleUkRegistration,calls,logs,advance:ms=>{now+=ms;}};
}

function assertSafeFailureLog(client,{code,stage,status}){
 assert.equal(client.logs.length,1);
 assert.equal(client.logs[0][0],'vehicle_lookup_failed');
 assert.equal(client.logs[0][1].code,code);
 assert.equal(client.logs[0][1].stage,stage);
 assert.equal(client.logs[0][1].status,status);
 assert.equal(client.logs[0][1].registration_hash,'63c9b47c5f01bba3341c2165b5ae0b3ace9398e91f130566bfa6225045f8b7d1');
 assert.doesNotMatch(JSON.stringify(client.logs),/AB12CDE|synthetic-secret|synthetic-key|synthetic-token/);
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

test('missing DVSA API key emits only a safe auth_missing diagnostic',async()=>{
 const c=client();c.env.DVSA_API_KEY=' ';assert.equal((await c.lookup('AB12CDE')).status,'unavailable');assertSafeFailureLog(c,{code:'auth_missing',stage:'configuration',status:null});
});

test('DVSA token 401 emits a safe auth_401 diagnostic',async()=>{
 const c=client({tokenStatus:401});assert.equal((await c.lookup('AB12CDE')).status,'unavailable');assertSafeFailureLog(c,{code:'auth_401',stage:'auth',status:401});
});

test('DVSA API 403 emits a safe api_403 diagnostic',async()=>{
 const c=client({status:403});assert.equal((await c.lookup('AB12CDE')).status,'unavailable');assertSafeFailureLog(c,{code:'api_403',stage:'api',status:403});
});

test('DVSA timeout emits a safe timeout diagnostic',async()=>{
 const c=client({network:'timeout'});assert.equal((await c.lookup('AB12CDE')).status,'unavailable');assertSafeFailureLog(c,{code:'timeout',stage:'auth',status:null});
});

test('invalid DVSA response emits a safe invalid_response diagnostic',async()=>{
 const c=client({vehicle:null});assert.equal((await c.lookup('AB12CDE')).status,'unavailable');assertSafeFailureLog(c,{code:'invalid_response',stage:'response',status:200});
});

test('mismatched DVSA registration emits a safe mapping_error diagnostic',async()=>{
 const c=client({vehicle:{...fixture,registration:'ZZ99ZZZ'}});assert.equal((await c.lookup('AB12CDE')).status,'unavailable');assertSafeFailureLog(c,{code:'mapping_error',stage:'mapping',status:200});
});

for(const [status,code,resultStatus] of [[400,'api_400','not_found'],[401,'api_401','unavailable'],[404,'api_404','not_found'],[429,'api_429','unavailable'],[500,'api_5xx','unavailable'],[503,'api_5xx','unavailable']]){
 test(`DVSA API ${status} emits ${code}`,async()=>{
  const c=client({status});assert.equal((await c.lookup('AB12CDE')).status,resultStatus);assertSafeFailureLog(c,{code,stage:'api',status});
 });
}

test('DVSA token 403 emits a safe auth_403 diagnostic',async()=>{
 const c=client({tokenStatus:403});assert.equal((await c.lookup('AB12CDE')).status,'unavailable');assertSafeFailureLog(c,{code:'auth_403',stage:'auth',status:403});
});

test('DVSA API timeout reports the API stage',async()=>{
 const c=client({network:'api-timeout'});assert.equal((await c.lookup('AB12CDE')).status,'unavailable');assertSafeFailureLog(c,{code:'timeout',stage:'api',status:null});
});
