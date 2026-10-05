import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const variant='72000000-0000-4000-8000-000000000010';
function load(path,modules){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Request,FormData,require(name){if(name in modules)return modules[name];throw Error(name);}});return exports;}
function subject({lookup={status:'found',registration:'AB16CDE',vehicle:{make:'HONDA',model:'JAZZ',year:2016,fuelType:'PETROL',engineSizeSimple:1300,colour:'GREY'}},rate={status:'available',allowed:true},rpcError=null,outcome='created'}={}){
 const writes=[],lookups=[];
 const modules={'server-only':{},'@/lib/data/vehicle-catalogue':{getCatalogueSelection:async()=>({variantId:variant,make:'HONDA',modelFamily:'JAZZ',year:2016,fuelType:'PETROL',engineSizeSimple:1300})},'@/lib/identifiers':{isUuid:v=>/^[0-9a-f-]{36}$/.test(v)},'@/lib/vehicle-lookup-operational':{consumeVehicleLookupRateLimit:async()=>rate},'@/lib/vehicle-registration':{normalizeRegistration:v=>v.toUpperCase().replace(/\s/g,''),isPlausibleUkRegistration:v=>/^[A-Z0-9]{2,8}$/.test(v),lookupVehicleByRegistration:async v=>{lookups.push(v);return lookup;}}};
 const helperPath=new URL('../src/lib/garage-save.ts',import.meta.url);
 const save=fs.existsSync(helperPath)?load('src/lib/garage-save.ts',modules):null;
 const database={rpc:async(name,args)=>{assert.equal(name,'save_garage_vehicle_v1');writes.push(args);return {data:rpcError?null:[{garage_vehicle_id:'saved-id',outcome,catalogue_variant_id:args.p_catalogue_variant_id??null}],error:rpcError};},from:()=>({select(){return this;},eq(){return this;},then:r=>Promise.resolve({data:[]}).then(r),insert(args){writes.push(args);return Promise.resolve({error:null});}})};
 modules['@/lib/garage-save']=save;modules['@/lib/auth']={requireUser:async()=>({id:'owner'})};modules['@/lib/supabase/server']={createSupabaseServerClient:async()=>database};modules['next/cache']={revalidatePath(){}};modules['next/headers']={headers:async()=>new Headers()};
 const web=load('src/app/garage/actions.ts',modules);
 const mobile=load('src/app/api/mobile/v1/garage/route.ts',{'@/lib/garage-save':save,'@/lib/identifiers':modules['@/lib/identifiers'],'@/lib/mobile-api':{requireMobileUser:async()=>({context:{user:{id:'owner'},supabase:database}}),mobileJson:(_request,data,status=200)=>({data,status})}});
 return {async save(input){const form=new FormData();for(const [k,v] of Object.entries(input))form.set(k,String(v));return web.saveGarageVehicle(form);},writes,lookups,helper:save,database,mobile};
}
test('identity-only save returns saved id and uses only guarded provider identity',async()=>{
 const s=subject(),result=await s.save({operation:'identity_save',registration:'ab16 cde',make:'FABRICATED',model:'FORGED',year:2099,profile_id:'other'});
 assert.equal(result?.ok,true);assert.equal(result.id,'saved-id');assert.equal(result.outcome,'created');assert.equal(s.writes.length,1);assert.equal(s.writes[0].p_make,'HONDA');assert.equal(s.writes[0].p_year,2016);assert.equal(s.writes[0].p_registration,'AB16CDE');assert.equal(s.writes[0].p_catalogue_variant_id,null);assert.ok(!('p_profile_id' in s.writes[0]));
});
test('duplicate identity has explicit already_exists outcome',async()=>{
 const s=subject({outcome:'already_exists'}),r=await s.save({operation:'identity_save',registration:'AB16CDE'});assert.equal(r?.outcome,'already_exists');assert.equal(r.id,'saved-id');
});
for(const [label,options] of [['unavailable',{lookup:{status:'unavailable',message:'provider raw'}}],['incomplete',{lookup:{status:'found',vehicle:{make:'HONDA',model:'JAZZ'}}}],['rate guard unavailable',{rate:{status:'unavailable',allowed:false}}],['rate limited',{rate:{status:'available',allowed:false}}]])test(label+' lookup returns feedback and writes nothing',async()=>{
 const s=subject(options),r=await s.save({operation:'identity_save',registration:'AB16CDE'});assert.equal(r?.ok,false);assert.ok(r.message);assert.equal(s.writes.length,0);if(label.startsWith('rate'))assert.equal(s.lookups.length,0);
});
test('manual selection resolves catalogue fields and never calls provider',async()=>{
 const s=subject(),r=await s.save({operation:'enrich_exact',variantId:variant,year:2016,fuel:'PETROL',engine:1300,make:'FABRICATED'});assert.equal(r?.ok,true);assert.equal(s.writes[0].p_make,'HONDA');assert.equal(s.writes[0].p_catalogue_variant_id,variant);assert.equal(s.lookups.length,0);
});
test('database errors are safe and retryable without raw provider/database details',async()=>{
 const s=subject({rpcError:{message:'SECRET SQL'}}),r=await s.save({operation:'identity_save',registration:'AB16CDE'});assert.equal(r?.ok,false);assert.doesNotMatch(r.message,/SECRET|SQL/);assert.equal(r.retryable,true);
});
test('mobile identity save uses the same provider/RPC contract and explicit creation outcome',async()=>{
 const s=subject(),r=await s.mobile.POST(new Request('https://example.test/api/mobile/v1/garage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation:'identity_save',registration:'ab16 cde',make:'FORGED',profile_id:'other'})}));
 assert.equal(r.status,201);assert.equal(r.data.id,'saved-id');assert.equal(r.data.outcome,'created');assert.equal(s.writes[0].p_make,'HONDA');assert.ok(!('p_profile_id' in s.writes[0]));
});
test('mobile rate guard fails safely before provider/database writes',async()=>{
 const s=subject({rate:{status:'available',allowed:false}}),r=await s.mobile.POST(new Request('https://example.test/garage',{method:'POST',body:JSON.stringify({operation:'identity_save',registration:'AB16CDE'})}));
 assert.equal(r.status,429);assert.equal(r.data.error,'lookup_rate_limited');assert.equal(s.writes.length,0);assert.equal(s.lookups.length,0);
});
