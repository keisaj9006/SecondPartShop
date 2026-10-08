/** Bounded exact-Preview QA. Credentials arrive through stdin; never load an env/credential file.
 * QUARANTINED: persistent shared-host fixture mutations are rejected by the owner-approved rollback-only strategy.
 * Stdin: {authorization,previewUrl,supabaseUrl,publicKey,runId,retainDisposableArtifacts,identities:{buyer,garage,stranger}}.
 * Each identity is {id,email,password}; only the three explicitly authorized UUIDs are accepted.
 * Tokens/cookies stay in memory. Output contains only case names, status codes and fixture UUIDs.
 */
import {createServerClient} from "@supabase/ssr";
import {pathToFileURL} from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const PREVIEW="https://second-part-shop-poxof2fu7-joannakwapis11-5369.vercel.app";
const SUPABASE="https://etkupijfdznljimrfyct.supabase.co";
const RUN_ID="rc26-hosted-20261008-autonomous";
const IDS={buyer:"4514c0f5-3d57-419f-9c12-852273739b27",garage:"c3004680-7cd8-418d-a79b-0c25faa3da6e",stranger:"7c7cad1e-9ed7-4afc-b2f4-00548554cf12"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function validateConfig(input){
 const reject=()=>{throw new Error("QA configuration rejected");};
 if(!input||input.authorization!=="preview-disposable-fixtures"||input.previewUrl!==PREVIEW||input.supabaseUrl!==SUPABASE)reject();
 if(typeof input.publicKey!=="string"||(!input.publicKey.startsWith("sb_publishable_")&&!input.publicKey.startsWith("eyJ")))reject();
 if(input.runId!==RUN_ID||typeof input.retainDisposableArtifacts!=="boolean")reject();
 for(const [role,id] of Object.entries(IDS)){
  const identity=input.identities?.[role];
  if(identity?.id!==id||identity.email!==`${RUN_ID}-${role}@qa.secondpart.invalid`||typeof identity.password!=="string"||identity.password.length<8)reject();
 }
 // Reject service-role JWTs locally before using a key. Only anon/publishable auth is needed.
 if(input.publicKey.startsWith("eyJ")){
  try{if(JSON.parse(Buffer.from(input.publicKey.split(".")[1],"base64url")).role!=="anon")reject();}catch{reject();}
 }
 return input;
}
const allowedPath=pathname=>["/","/garage","/account","/account/reviews","/account/security"].includes(pathname)||/^\/api\/mobile\/v1\/(me|profile|garage|saved-searches|reviews|fit-feedback|vehicle-catalogue|categories|seller\/listings)$/.test(pathname);
export function createPreviewRequest(config,fetcher=fetch){
 return async(relative,{session=null,mobile=false,method="GET",body,rawBody}={})=>{
  const url=new URL(relative,config.previewUrl);
  if(!relative.startsWith("/")||relative.startsWith("//")||url.origin!==config.previewUrl||!allowedPath(url.pathname))throw new Error("unsafe request");
  const headers=new Headers({accept:url.pathname.startsWith("/api/")?"application/json":"text/html"});
  if(session){
   headers.set("cookie",[...session.cookies].map(([name,value])=>`${name}=${encodeURIComponent(value)}`).join("; "));
   if(mobile)headers.set("authorization",`Bearer ${session.accessToken}`);
  }
  if(body!==undefined||rawBody!==undefined)headers.set("content-type","application/json");
  const response=await fetcher(url.href,{method,headers,body:rawBody??(body===undefined?undefined:JSON.stringify(body)),redirect:"manual",signal:AbortSignal.timeout(30000)});
  if(session){
   for(const cookie of response.headers.getSetCookie?.()??[]){
    const pair=cookie.split(";")[0],index=pair.indexOf("=");
    if(index>0){const name=pair.slice(0,index),value=decodeURIComponent(pair.slice(index+1));if(/max-age=0/i.test(cookie))session.cookies.delete(name);else session.cookies.set(name,value);}
   }
  }
  const text=await response.text();
  if(text.length>3000000)throw new Error("response too large");
  let data=null;try{data=JSON.parse(text);}catch{/* HTML or a controlled non-JSON response. */}
  return {status:response.status,headers:response.headers,data,text};
 };
}
async function signIn(config,role){
 const identity=config.identities[role],cookies=new Map();
 const client=createServerClient(config.supabaseUrl,config.publicKey,{auth:{autoRefreshToken:false,detectSessionInUrl:false},cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:updates=>{for(const {name,value} of updates)cookies.set(name,value);}}});
 const {data,error}=await client.auth.signInWithPassword({email:identity.email,password:identity.password});
 if(error||data.user?.id!==identity.id||!data.session||data.user.app_metadata?.qa_run_id!==config.runId)throw new Error("fixture authentication rejected");
 return {cookies,accessToken:data.session.access_token,client};
}
const expected=(response,status,error)=>{assert.equal(response.status,status);if(error)assert.equal(response.data?.error,error);return response;};
const api=(request,session,relative,options={})=>request(`/api/mobile/v1/${relative}`,{session,mobile:true,...options});
async function catalogueSelections(request){
 const makes=expected(await request("/api/mobile/v1/vehicle-catalogue?level=makes"),200).data.items;
 const selections=[];
 for(const make of makes.slice(0,4)){
  const models=expected(await request(`/api/mobile/v1/vehicle-catalogue?level=models&make=${encodeURIComponent(make)}`),200).data.items;
  for(const model of models.slice(0,2)){
   const variants=expected(await request(`/api/mobile/v1/vehicle-catalogue?level=variants&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`),200).data.items;
   for(const variant of variants.slice(0,2)){
    const years=expected(await request(`/api/mobile/v1/vehicle-catalogue?level=years&variantId=${variant.id}`),200).data.items;
    for(const year of years.slice(0,2)){
     const selection=expected(await request(`/api/mobile/v1/vehicle-catalogue?level=selection&variantId=${variant.id}&year=${year}`),200).data.item;
     selections.push(selection);if(selections.length===2)return selections;
    }
   }
  }
 }
 throw new Error("two exact catalogue selections unavailable");
}
export async function runPreviewProductQa(rawInput){
 const config=validateConfig(rawInput);
 // Preserve this prototype as evidence; even valid disposable credentials cannot enable shared-host writes.
 if(config.supabaseUrl===SUPABASE)throw new Error("Shared-host mutation harness quarantined under rollback-only acceptance strategy.");
 const request=createPreviewRequest(config),sessions={},fixtures={garage:[],savedSearches:[]},results=[];
 let completed=false,activeCase="fixture authentication";
 const emit=value=>process.stdout.write(JSON.stringify(value)+"\n");
 const check=async(name,work)=>{
  activeCase=name;
  try{const status=await work();results.push({case:name,status:"passed",...(Number.isInteger(status)?{httpStatus:status}:{})});emit(results.at(-1));}
  catch{results.push({case:name,status:"failed"});emit(results.at(-1));throw new Error("QA case failed");}
 };
 try{
  await check("fixture authentication",async()=>{for(const role of Object.keys(IDS))sessions[role]=await signIn(config,role);});
  await check("cookie-authenticated hosted Account and anonymous Garage return",async()=>{
   const account=expected(await request("/account",{session:sessions.buyer}),200);assert.ok(account.text.includes("Sign out of SecondPart"));
   const anonymous=await request("/garage");assert.ok([303,307].includes(anonymous.status));const destination=new URL(anonymous.headers.get("location"),PREVIEW);assert.equal(destination.origin,PREVIEW);assert.equal(destination.pathname,"/account");assert.equal(destination.searchParams.get("returnTo"),"/garage");
  });
  for(const endpoint of ["me","profile","garage","saved-searches","reviews","fit-feedback","seller/listings"]){
   await check(`anonymous ${endpoint} is unauthorized`,async()=>expected(await api(request,null,endpoint),401,"unauthorized").status);
  }
  await check("private API rejects cookie-only auth and malformed bearer",async()=>{
   expected(await request("/api/mobile/v1/garage",{session:sessions.buyer}),401,"unauthorized");
   expected(await request("/api/mobile/v1/profile",{session:{cookies:new Map(),accessToken:"invalid-invalid-invalid"},mobile:true}),401,"unauthorized");
  });
  await check("fresh fixture profiles and artifact preconditions",async()=>{
   for(const role of Object.keys(IDS)){
    const me=expected(await api(request,sessions[role],"me"),200).data;assert.equal(me.profile?.id,IDS[role]);assert.equal(me.profile?.role,"buyer");assert.equal(me.seller,null);
    for(const endpoint of ["garage","saved-searches","reviews","fit-feedback"])assert.equal(expected(await api(request,sessions[role],endpoint),200).data.items.length,0);
   }
  });
  await check("negative payloads fail without creating fixtures",async()=>{
   expected(await api(request,sessions.buyer,"garage",{method:"POST",body:{operation:"enrich_exact",variantId:"not-a-uuid",year:2000}}),400,"invalid_vehicle");
   expected(await api(request,sessions.buyer,"garage",{method:"POST",rawBody:"{"}),400,"invalid_json");
   expected(await api(request,sessions.buyer,"garage?id=bad",{method:"DELETE"}),400,"invalid_vehicle");
   expected(await api(request,sessions.buyer,"saved-searches",{method:"POST",body:{name:"x",params:{fit:"0"}}}),400,"saved_search_name_required");
   expected(await api(request,sessions.buyer,"saved-searches",{method:"POST",body:{name:"QA invalid",params:{external:"rejected"}}}),400,"saved_search_filters_required");
   expected(await api(request,sessions.buyer,"seller/listings",{method:"POST",body:{title:"QA non-seller"}}),403,"seller_required");
  });
  let selections;
  await check("manual exact catalogue discovery",async()=>{selections=await catalogueSelections(request);});
  for(let index=0;index<2;index++)await check(`manual catalogue Garage create ${index+1}`,async()=>{
   const item=selections[index],response=expected(await api(request,sessions.buyer,"garage",{method:"POST",body:{operation:"enrich_exact",variantId:item.variantId,year:item.year,nickname:`${config.runId}_${index+1}`}}),201);
   assert.match(response.data.id,UUID);fixtures.garage.push(response.data.id);assert.equal(response.data.catalogueVariantId,item.variantId);return response.status;
  });
  await check("Garage duplicate create is idempotent and reads both own vehicles",async()=>{
   const item=selections[0];const repeat=expected(await api(request,sessions.buyer,"garage",{method:"POST",body:{variantId:item.variantId,year:item.year}}),200);assert.equal(repeat.data.id,fixtures.garage[0]);assert.equal(repeat.data.outcome,"already_exists");
   const rows=expected(await api(request,sessions.buyer,"garage"),200).data.items;assert.deepEqual(new Set(rows.map(row=>row.id)),new Set(fixtures.garage));
  });
  for(let index=0;index<2;index++)for(const fit of ["0","1"])await check(`hosted Garage current vehicle ${index+1} fit=${fit}`,async()=>{
   const response=expected(await request(`/garage?gv=${fixtures.garage[index]}&fit=${fit}`,{session:sessions.buyer}),200);
   const articles=[...response.text.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(match=>match[0]);const current=articles.filter(html=>html.includes("Current vehicle"));
   assert.equal(current.length,1);assert.ok(current[0].includes(`${config.runId}_${index+1}`));assert.equal(/<input[^>]*checked/.test(current[0]),fit==="1");return response.status;
  });
  await check("stranger cannot select, enrich or delete owner's Garage vehicle",async()=>{
   const owned=fixtures.garage[0],item=selections[0];
   assert.equal(expected(await api(request,sessions.stranger,"garage"),200).data.items.length,0);
   const page=expected(await request(`/garage?gv=${owned}&fit=1`,{session:sessions.stranger}),200);assert.ok(!page.text.includes("Current vehicle"));assert.ok(!page.text.includes(`${config.runId}_1`));
   const enrich=await api(request,sessions.stranger,"garage",{method:"POST",body:{operation:"enrich_exact",garageVehicleId:owned,variantId:item.variantId,year:item.year}});assert.ok([400,503].includes(enrich.status));assert.equal(enrich.data.ok,false);
   expected(await api(request,sessions.stranger,`garage?id=${owned}`,{method:"DELETE"}),200);
   assert.ok(expected(await api(request,sessions.buyer,"garage"),200).data.items.some(row=>row.id===owned));
  });
  for(const fit of ["0","1"])await check(`saved search fit=${fit} round trip`,async()=>{
   const params={q:`${config.runId}`,cv:selections[0].variantId,cy:String(selections[0].year),fit};
   const response=expected(await api(request,sessions.buyer,"saved-searches",{method:"POST",body:{name:`${config.runId}_fit${fit}`,params}}),201);assert.match(response.data.id,UUID);fixtures.savedSearches.push(response.data.id);
   const saved=expected(await api(request,sessions.buyer,"saved-searches"),200).data.items.find(row=>row.id===response.data.id);assert.deepEqual(saved.params,params);return response.status;
  });
  await check("stranger saved-search deletion is a no-op",async()=>{
   const id=fixtures.savedSearches[0];expected(await api(request,sessions.stranger,`saved-searches?id=${id}`,{method:"DELETE"}),200);
   assert.equal(expected(await api(request,sessions.stranger,"saved-searches"),200).data.items.length,0);assert.ok(expected(await api(request,sessions.buyer,"saved-searches"),200).data.items.some(row=>row.id===id));
  });
  await check("reviews and Verified Fit require qualifying transactions",async()=>{
   expected(await api(request,sessions.buyer,"reviews",{method:"POST",body:{overall:5}}),400,"transaction_required");
   expected(await api(request,sessions.buyer,"reviews",{method:"POST",body:{orderItemId:randomUUID(),overall:6}}),400,"invalid_rating");
   expected(await api(request,sessions.buyer,"reviews",{method:"POST",body:{orderItemId:randomUUID(),overall:5}}),409);
   expected(await api(request,sessions.buyer,"fit-feedback",{method:"POST",body:{result:"exact_fit"}}),400,"transaction_required");
   expected(await api(request,sessions.buyer,"fit-feedback",{method:"POST",body:{orderItemId:randomUUID(),result:"invented"}}),400,"invalid_fit_result");
   expected(await api(request,sessions.buyer,"fit-feedback",{method:"POST",body:{orderItemId:randomUUID(),result:"exact_fit"}}),409);
   for(const endpoint of ["reviews","fit-feedback"])assert.equal(expected(await api(request,sessions.buyer,endpoint),200).data.items.length,0);
  });
  results.push({case:"seller draft update lifecycle",status:"gated"});emit(results.at(-1));
  completed=true;
 }catch{if(!results.some(result=>result.status==="failed")){results.push({case:activeCase,status:"failed"});emit(results.at(-1));}}
 finally{
  // Only IDs created by this run can be removed; never bulk-delete or delete Auth identities.
  const retain=completed&&config.retainDisposableArtifacts;
  for(const [key,endpoint] of [["garage","garage"],["savedSearches","saved-searches"]]){
   const cleanup=retain?fixtures[key].slice(1):fixtures[key];
   for(const id of cleanup)await check(`cleanup ${endpoint} fixture`,async()=>{
    expected(await api(request,sessions.buyer,`${endpoint}?id=${id}`,{method:"DELETE"}),200);
    assert.ok(!expected(await api(request,sessions.buyer,endpoint),200).data.items.some(row=>row.id===id));
   }).catch(()=>{});
  }
  emit({case:"summary",status:results.some(result=>result.status==="failed")?"failed":"passed",passed:results.filter(result=>result.status==="passed").length,failed:results.filter(result=>result.status==="failed").length,fixtures,retained:retain?{garage:fixtures.garage.slice(0,1),savedSearches:fixtures.savedSearches.slice(0,1)}:{garage:[],savedSearches:[]}});
  for(const session of Object.values(sessions)){session.cookies.clear();session.accessToken="";}
 }
 return results.some(result=>result.status==="failed")?1:0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 if(process.argv.length!==3||process.argv[2]!=="--execute"){process.stderr.write("Use --execute with authorized JSON on stdin; no network requests made.\n");process.exitCode=2;}
 else{
  try{let input="";for await(const chunk of process.stdin){input+=chunk;if(input.length>32000)throw new Error("input rejected");}process.exitCode=await runPreviewProductQa(JSON.parse(input));}
  catch{process.stderr.write("QA input or execution rejected; credentials were not logged.\n");process.exitCode=2;}
 }
}
