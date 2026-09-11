import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const owner="11111111-1111-4111-8111-111111111111";
const partId="22222222-2222-4222-8222-222222222222";
const imageId="33333333-3333-4333-8333-333333333333";
const path=`${owner}/${partId}/44444444-4444-4444-8444-444444444444.jpg`;
function load(file,deps){
 const exports={};
 const code=ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>deps[name]??{},URL,FormData,File,Uint8Array,crypto:globalThis.crypto,process});
 return exports;
}
function boundary(kind,{status="draft",partMissing=false,deleteError=null,zero=false,cleanupFails=false,ready=true}={}){
 const events=[];
 const supabase={from(table){
  let removing=false;
  const q={select(){return q;},eq(){return q;},delete(){removing=true;events.push("metadata");return q;},
   async maybeSingle(){return removing?{data:zero?null:{id:imageId,storage_path:path},error:deleteError}:{data:table==="parts"?(partMissing?null:{id:partId,slug:"part",status}):{id:imageId,storage_path:path},error:null};},
   then(resolve){resolve(removing?{data:zero?null:{id:imageId,storage_path:path},error:deleteError}:{count:2,error:null});}
  };return q;
 },storage:{from:()=>({remove:async()=>{events.push("unsafe-storage");return {error:null};}})}};
 const cleanup={requirePartImageCleanupReady:async()=>{if(!ready)throw new Error("Migration unavailable");},attemptPartImageCleanup:async p=>{events.push(["cleanup",p]);return !cleanupFails;}};
 const api=load(kind==="web"?"../src/app/dashboard/actions.ts":"../src/app/api/mobile/v1/seller/listings/[partId]/photos/route.ts",{
  "next/cache":{revalidatePath(){}},"@/lib/auth":{requireSeller:async()=>({user:{id:owner}})},
  "@/lib/data/marketplace":{getSellerForOwner:async()=>({id:"seller"})},
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>supabase},
  "@/lib/part-image-cleanup":cleanup,"@/lib/identifiers":{isUuid:()=>true},
  "@/lib/mobile-api":{requireMobileSeller:async()=>({context:{user:{id:owner},supabase},seller:{id:"seller"}}),mobileJson:(_r,body,status=200)=>({body,status})}
 });
 return {events,run:async()=>{if(kind==="mobile")return api.DELETE({url:`https://example.test/?imageId=${imageId}`},{params:Promise.resolve({partId})});const form=new FormData();form.set("partId",partId);form.set("imageId",imageId);return api.deleteListingImage(form);}};
}
for(const kind of ["web","mobile"]){
 for(const [name,options] of [["reserved",{status:"reserved"}],["unauthorized",{partMissing:true}],["RLS zero rows",{zero:true}],["metadata failure",{deleteError:{message:"DB failed"}}]]){
  test(`${kind}: ${name} never removes bytes`,async()=>{
   const b=boundary(kind,options);await b.run().catch(()=>{});
   assert.ok(!b.events.some(e=>e==="unsafe-storage"||Array.isArray(e)),JSON.stringify(b.events));
  });
 }
 test(`${kind}: actual deleted row authorizes exact-path cleanup after metadata`,async()=>{
  const b=boundary(kind);await b.run();assert.deepEqual(b.events,["metadata",["cleanup",path]]);
 });
 test(`${kind}: cleanup failure does not undo successful metadata removal`,async()=>{
  const b=boundary(kind,{cleanupFails:true});const result=await b.run();
  assert.deepEqual(b.events,["metadata",["cleanup",path]]);
  if(kind==="mobile")assert.equal(result.body.deleted,true);
 });
 test(`${kind}: schema rollout readiness failure prevents metadata mutation`,async()=>{const b=boundary(kind,{ready:false});await b.run().catch(()=>{});assert.deepEqual(b.events,[]);});
}

function privacyOrphans({detached=false,listError=false,removeError=false,unsafeName=false,count=1}={}){
 const events=[];let authExists=!detached;
 const objects=new Set(Array.from({length:count},(_,i)=>`${owner}/${partId}/orphan-${i}.jpg`));
 const admin={from(table){const q={select(){return q;},eq(){return q;},order(){return q;},range:async()=>({data:[],error:null}),maybeSingle:async()=>({data:{id:"request",status:"processing",profile_id:detached?null:owner,target_profile_id:owner},error:null})};assert.ok(["account_deletion_requests","transaction_case_evidence"].includes(table));return q;},
  rpc:async name=>{events.push(name);return {data:name==="get_account_deletion_part_image_paths"?[]:true,error:null};},
  storage:{from:bucket=>({list:async(folder,{limit,offset})=>{events.push(["list",folder,offset]);assert.equal(bucket,"part-images");if(listError)return {error:{message:"list failed"},data:null};if(unsafeName)return {error:null,data:[{name:"../victim.jpg",id:"bad"}]};const names=new Map();for(const path of objects){if(!path.startsWith(folder+"/"))continue;const rest=path.slice(folder.length+1);const [name,...extra]=rest.split("/");names.set(name,{name,id:extra.length?null:"object"});}return {data:[...names.values()].slice(offset,offset+limit),error:null};},remove:async paths=>{events.push(["remove",...paths]);if(removeError)return {error:{message:"remove failed"}};for(const path of paths)objects.delete(path);return {error:null};}})},
  auth:{admin:{getUserById:async()=>({data:{user:authExists?{id:owner}:null},error:null}),deleteUser:async()=>{events.push("auth-delete");authExists=false;return {error:null};}}}};
 const api=load("../src/lib/account-deletion.ts",{"@/lib/supabase/admin":{createSupabaseAdminClient:()=>admin},"@/lib/part-image-cleanup":{requirePartImageCleanupReady:async()=>{},attemptPartImageCleanup:async()=>true}});
 return {events,objects,run:()=>api.processAccountDeletionRequest("request")};
}
for(const detached of [false,true]){
 test(`privacy ${detached?"detached":"ordinary"} removes untracked owner-prefix uploads before completion`,async()=>{const b=privacyOrphans({detached,count:205});const result=await b.run();assert.equal(result.status,"completed");assert.equal(b.objects.size,0);const final=b.events.indexOf("complete_account_deletion_request");assert.ok(b.events.findIndex(e=>Array.isArray(e)&&e[0]==="remove")<final);assert.ok(b.events.filter(e=>Array.isArray(e)&&e[0]==="list").every(e=>e[2]===0));});
 test(`privacy ${detached?"detached":"ordinary"}: bounded orphan cleanup resumes without skipping`,async()=>{const b=privacyOrphans({detached,count:605});assert.notEqual((await b.run()).status,"completed");assert.equal(b.objects.size,105);assert.ok(!b.events.includes("complete_account_deletion_request"));assert.equal((await b.run()).status,"completed");assert.equal(b.objects.size,0);});
 for(const option of ["listError","removeError","unsafeName"]){
  test(`privacy ${detached?"detached":"ordinary"}: ${option} blocks finalization`,async()=>{const b=privacyOrphans({detached,[option]:true});const result=await b.run();assert.notEqual(result.status,"completed");assert.ok(!b.events.includes("complete_account_deletion_request"));assert.ok(!b.events.includes("auth-delete"));if(option==="unsafeName")assert.ok(!b.events.some(e=>Array.isArray(e)&&e[0]==="remove"));});
 }
}

function worker({rpcFailure=false,storageFailure=false,rows=[{storage_path:path}],completeFailure=false}={}){
 const events=[];
 const admin={rpc:async(name,args)=>{events.push([name,args]);return {data:name==="get_part_image_cleanup_queue"?rows:true,error:rpcFailure||name==="complete_part_image_cleanup"&&completeFailure?{message:"RPC failed"}:null};},storage:{from:bucket=>({remove:async paths=>{events.push(["storage",bucket,...paths]);return {data:[],error:storageFailure?{message:"Storage failed"}:null};}})}};
 const api=load("../src/lib/part-image-cleanup.ts",{"@/lib/supabase/admin":{createSupabaseAdminClient:()=>admin},"@/lib/ops-monitoring":{reportOperationalWarning(){}}});
 return {events,api};
}
test("worker fails closed when durable authorization RPC fails",async()=>{const b=worker({rpcFailure:true});assert.equal(await b.api.attemptPartImageCleanup(path),false);assert.ok(!b.events.some(e=>e[0]==="storage"));});
test("worker does not remove paths absent from outbox",async()=>{const b=worker({rows:[]});await b.api.attemptPartImageCleanup(path);assert.ok(!b.events.some(e=>e[0]==="storage"));});
test("Storage failure leaves cleanup pending",async()=>{const b=worker({storageFailure:true});assert.equal(await b.api.attemptPartImageCleanup(path),false);assert.ok(!b.events.some(e=>e[0]==="complete_part_image_cleanup"));});
test("successful or absent object removal can repeat safely",async()=>{const b=worker();assert.equal(await b.api.attemptPartImageCleanup(path),true);assert.equal(await b.api.attemptPartImageCleanup(path),true);assert.equal(b.events.filter(e=>e[0]==="complete_part_image_cleanup").length,2);});
test("lost completion response keeps retry required",async()=>{const b=worker({completeFailure:true});assert.equal(await b.api.attemptPartImageCleanup(path),false);});

for(const detached of [false,true]){
 test(`privacy ${detached?"resumed after detachment":"ordinary"}: pending Storage cleanup blocks identity finalization`,async()=>{
  const events=[];
  const admin={from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:"request",status:"processing",profile_id:detached?null:owner,target_profile_id:owner},error:null}),delete(){events.push("metadata");return this;},in:async()=>({error:null})}),
   rpc:async(name)=>{events.push(name);return {data:name==="get_account_deletion_part_image_paths"?[{storage_path:path}]:true,error:null};},
   storage:{from:()=>({remove:async()=>{events.push("legacy-storage");return {error:null};}})},
   auth:{admin:{getUserById:async()=>({data:{user:detached?null:{id:owner}},error:null}),deleteUser:async()=>{events.push("auth-delete");return {error:null};}}}};
  const api=load("../src/lib/account-deletion.ts",{"@/lib/supabase/admin":{createSupabaseAdminClient:()=>admin},"@/lib/part-image-cleanup":{requirePartImageCleanupReady:async()=>{},attemptPartImageCleanup:async()=>{events.push("cleanup");return false;}}});
  const result=await api.processAccountDeletionRequest("request");
  assert.notEqual(result.status,"completed");
  assert.ok(events.includes("cleanup"));
  assert.ok(!events.includes("complete_account_deletion_request"));
  assert.ok(!events.includes("auth-delete"));
 });
}

for(const kind of ["web","mobile"]){
 test(`${kind}: failed attachment queues only server-generated upload path`,async()=>{
  const uploaded=[],queued=[];
  const supabase={from(table){const q={select(){return q;},eq(){return q;},order(){return q;},limit:async()=>({data:[]}),insert:async()=>({error:{message:"attach failed"}}),maybeSingle:async()=>({data:table==="parts"?{id:partId,title:"Photo part",status:"draft"}:{}}),then:r=>r({count:0,error:null})};q.insert=()=>({select:()=>({single:async()=>({data:null,error:{message:"attach failed"}})}),then:r=>r({error:{message:"attach failed"}})});return q;},storage:{from:()=>({upload:async p=>{uploaded.push(p);return {error:null};},remove:async()=>{throw new Error("Direct deletion forbidden");}})}};
  const deps={"@/lib/supabase/server":{createSupabaseServerClient:async()=>supabase},"@/lib/image-upload":{validateImageUpload:async()=>({extension:"jpg",mimeType:"image/jpeg"})},"@/lib/part-image-cleanup":{requirePartImageCleanupReady:async()=>{},cleanupFailedPartImageUpload:async(...args)=>{queued.push(args);return false;}},"node:crypto":{randomUUID:()=>"44444444-4444-4444-8444-444444444444"},"@/lib/identifiers":{isUuid:()=>true},"@/lib/mobile-api":{requireMobileSeller:async()=>({context:{user:{id:owner},supabase},seller:{id:"seller"}}),mobileMarketplaceTermsAccepted:async()=>true,mobileJson:(_r,body,status)=>({body,status})}};
  const file="../src/app/"+(kind==="web"?"dashboard/actions.ts":"api/mobile/v1/seller/listings/[partId]/photos/route.ts");
  // Expose the existing private upload helper in the isolated compiled module;
  // production code remains private and the whole action module is evaluated.
  let api;
  if(kind==="web"){
   const source=fs.readFileSync(new URL(file,import.meta.url),"utf8")+"\nexport { uploadImage };";
   const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>deps[n]??{},crypto:globalThis.crypto,File});api=exports;
   await api.uploadImage(partId,owner,"Photo part",new File(["image"],"photo.jpg"),0).catch(()=>{});
  }else{
   api=load(file,deps);const form=new FormData();form.set("file",new File(["image"],"photo.jpg"));form.set("storagePath","victim/arbitrary.jpg");
   const response=await api.POST({formData:async()=>form},{params:Promise.resolve({partId})});assert.equal(response.body.error,"photo_attach_failed");
  }
  assert.equal(uploaded.length,1);assert.equal(queued.length,1);assert.equal(queued[0][0],owner);assert.equal(queued[0][1],partId);assert.equal(queued[0][2],uploaded[0]);assert.ok(uploaded[0].startsWith(`${owner}/${partId}/`));
 });
}
