import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const WEB_SOURCE=fs.readFileSync(new URL("../src/app/checkout/actions.ts",import.meta.url),"utf8");
const MOBILE_SOURCE=fs.readFileSync(new URL("../src/app/api/mobile/v1/checkout/route.ts",import.meta.url),"utf8");
const VEHICLE_SOURCE=fs.readFileSync(new URL("../src/lib/checkout-vehicle.ts",import.meta.url),"utf8");
const compile=(source)=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const BUYER="11111111-1111-4111-8111-111111111111";
const PART="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GARAGE="22222222-2222-4222-8222-222222222222";
const FOREIGN="33333333-3333-4333-8333-333333333333";
const VARIANT="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TAMPERED_VARIANT="cccccccc-cccc-4ccc-8ccc-cccccccccccc";

class RedirectSignal extends Error{constructor(url){super("redirect:"+url);this.url=url;}}

function harness(kind,{garageRows={},compatibility={level:"confirmed"}}={}){
 const calls={garageRead:0,garageOwner:null,garageId:null,sellerSync:0,compatibility:[],rpc:[],stripe:0};
 const exports={};
 const vehicleExports={};
 vm.runInNewContext(compile(VEHICLE_SOURCE),{exports:vehicleExports,require(name){if(name==="server-only")return {};if(name==="@/lib/identifiers")return {isUuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}};throw new Error("Unexpected vehicle dependency: "+name);}});
 const supabase={
  from(table){
   assert.ok(table==="parts"||table==="garage_vehicles",`unexpected table ${table}`);
   const query={selected:null,owner:null,id:null,
    select(value){this.selected=value;return this;},eq(column,value){if(column==="profile_id")this.owner=value;if(column==="id")this.id=value;return this;},
    async maybeSingle(){
     if(table==="parts")return {data:{slug:"qa-part",seller_id:"seller_test"},error:null};
     calls.garageRead++;calls.garageOwner=this.owner;calls.garageId=this.id;
     const row=garageRows[this.id]??null;
     return {data:row&&row.profile_id===this.owner?row:null,error:null};
    }
   };return query;
  },
  async rpc(name,args){calls.rpc.push({name,args});return {data:[{order_id:"44444444-4444-4444-8444-444444444444",part_title:"QA Part",quantity:1,unit_price_pence:1000,shipping_pence:0,checkout_expires_at:"2026-10-05T15:00:00Z"}],error:null};}
 };
 const load=(source)=>vm.runInNewContext(compile(source),{exports,console,URL,Request,Response,Headers,FormData,process:{env:{}},require(name){
  if(name==="next/headers")return {async headers(){return new Headers({host:"secondpart.test","x-forwarded-proto":"https"});}};
  if(name==="next/navigation")return {redirect(url){throw new RedirectSignal(url);}};
  if(name==="@/lib/auth")return {async requireUser(){return {id:BUYER,email:"buyer@example.test"};}};
  if(name==="@/lib/checkout-lifecycle")return {async attachCheckoutSession(){return "https://checkout.stripe.test/session";},async cancelCheckoutOrder(){return "cancelled";}};
  if(name==="@/lib/checkout-return-origin")return {resolveCheckoutReturnOrigin(){return "https://secondpart.test";}};
  if(name==="@/lib/supabase/server")return {async createSupabaseServerClient(){return supabase;}};
  if(name==="@/lib/stripe-payments")return {isStripeCheckoutConfigured(){return true;},getCreatedCheckoutSessionId(){return null;},async createCheckoutSession(){calls.stripe++;return {id:"cs_test",url:"https://checkout.stripe.test/session"};}};
  if(name==="@/lib/stripe-connect")return {getAppUrl(){return "https://secondpart.test";}};
  if(name==="@/lib/identifiers")return {isUuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}};
  if(name==="@/lib/data/compatibility")return {async getPartCompatibility(_part,filters){calls.compatibility.push(filters);if(compatibility instanceof Error)throw compatibility;return compatibility;}};
  if(name==="@/lib/checkout-vehicle")return vehicleExports;
  if(name==="@/lib/seller-payment-sync")return {async syncSellerPaymentAccount(){calls.sellerSync++;return {active:true,status:"active"};}};
  if(name==="@/lib/ops-monitoring")return {async reportOperationalError(){}};
  if(name==="@/lib/mobile-api")return {mobileOptions(){return new Response(null,{status:204});},mobileJson(_request,payload,status=200){return new Response(JSON.stringify(payload),{status,headers:{"content-type":"application/json"}});},async requireMobileUser(){return {context:{user:{id:BUYER,email:"buyer@example.test"},supabase}};}};
  throw new Error("Unexpected dependency: "+name);
 }});
 if(kind==="web")load(WEB_SOURCE);else load(MOBILE_SOURCE);
 return {api:exports,calls};
}

function profile(overrides={}){return {id:GARAGE,profile_id:BUYER,catalogue_variant_id:VARIANT,year:2020,fuel_type:"Diesel",engine_size_simple:1997,registration:"SE66 PPO",...overrides};}
function webForm(gv,extra={}){const form=new FormData();form.set("partId",PART);form.set("quantity","1");form.set("deliveryMethod","shipping");if(gv!==undefined)form.set("garageVehicleId",gv);for(const [key,value] of Object.entries(extra))form.set(key,String(value));return form;}
function mobileRequest(gv,extra={}){const {compatibilityAcknowledged,...vehicleFields}=extra;return new Request("https://secondpart.test/api/mobile/v1/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({partId:PART,quantity:1,deliveryMethod:"shipping",...(gv!==undefined?{vehicle:{garageVehicleId:gv,...vehicleFields}}:Object.keys(vehicleFields).length?{vehicle:vehicleFields}:{}),...(compatibilityAcknowledged!==undefined?{compatibilityAcknowledged}:{})})});}

for(const [kind,label] of [["web","web"],["mobile","mobile"]]){
 test(`${label} checkout rejects malformed, missing, foreign and identity-only Garage IDs before any checkout side effect`,async()=>{
  const rows={
   [FOREIGN]:profile({id:FOREIGN,profile_id:"99999999-9999-4999-8999-999999999999"}),
   [GARAGE]:profile({catalogue_variant_id:null})
  };
  for(const garageId of ["not-a-uuid",FOREIGN,GARAGE]){
   const {api,calls}=harness(kind,{garageRows:rows});
   let result;
   if(kind==="web")result=await api.startCheckout({},webForm(garageId,{vehicleVariantId:TAMPERED_VARIANT,vehicleYear:2020}));
   else{const response=await api.POST(mobileRequest(garageId,{variantId:TAMPERED_VARIANT,year:2020}));result={status:response.status,body:await response.json()};}
   if(kind==="web")assert.equal(result.status,"error");else assert.ok(result.status===400||result.status===409);
   assert.equal(calls.sellerSync,0,"invalid selected Garage context must be rejected before seller provider checks");
   assert.equal(calls.rpc.length,0,"invalid selected Garage context must be rejected before stock reservation");
   assert.equal(calls.stripe,0,"invalid selected Garage context must be rejected before Stripe");
   assert.equal(calls.compatibility.length,0,"an incomplete identity must not be compatibility-matched");
   if(garageId==="not-a-uuid")assert.equal(calls.garageRead,0,"malformed IDs must not trigger a lookup");
   else assert.equal(calls.garageOwner,BUYER,"Garage lookup must be scoped to the authenticated buyer");
  }
 });

 test(`${label} checkout ignores client fitment claims and uses the owner Garage profile`,async()=>{
  const {api,calls}=harness(kind,{garageRows:{[GARAGE]:profile()}});
  let result;
  if(kind==="web"){
   try{await api.startCheckout({},webForm(GARAGE,{vehicleVariantId:TAMPERED_VARIANT,vehicleYear:2018,vehicleFuel:"Petrol",vehicleRegistration:"FAKE REG"}));assert.fail("successful checkout should redirect");}
   catch(error){assert.match(error.message,/^redirect:/);result={status:"redirect"};}
  }else{const response=await api.POST(mobileRequest(GARAGE,{variantId:TAMPERED_VARIANT,year:2018,fuel:"Petrol",registration:"FAKE REG"}));result={status:response.status};}
  if(kind==="web")assert.equal(result.status,"redirect");else assert.equal(result.status,201);
  assert.equal(calls.garageOwner,BUYER);
  assert.equal(calls.compatibility.length,1);
  assert.equal(calls.compatibility[0].catalogueVariant,VARIANT);
  assert.equal(calls.compatibility[0].catalogueYear,2020);
  assert.equal(calls.compatibility[0].catalogueFuel,"Diesel");
  const reservation=calls.rpc.find(call=>call.name==="prepare_checkout_order_v2");
  assert.ok(reservation);
  assert.equal(reservation.args.p_vehicle_variant_id,VARIANT);
  assert.equal(reservation.args.p_vehicle_year,2020);
  assert.equal(reservation.args.p_vehicle_fuel,"Diesel");
  assert.equal(reservation.args.p_vehicle_registration,"SE66 PPO");
  assert.equal(calls.stripe,1);
 });

 test(`${label} checkout preserves family/unverified acknowledgement before reservation`,async()=>{
  for(const level of ["family_match","unverified"]){
   const {api,calls}=harness(kind,{garageRows:{[GARAGE]:profile()},compatibility:{level}});
   let result;
   if(kind==="web")result=await api.startCheckout({},webForm(GARAGE));
   else{const response=await api.POST(mobileRequest(GARAGE));result={status:response.status};}
   if(kind==="web")assert.equal(result.status,"error");else assert.equal(result.status,409);
   assert.equal(calls.rpc.length,0);
   assert.equal(calls.stripe,0);
  }
 });

 test(`${label} manual catalogue and no-vehicle checkout retain their established paths`,async()=>{
  if(kind==="web"){
   const blocked=harness(kind,{compatibility:{level:"unverified"}});
   const blockedResult=await blocked.api.startCheckout({},webForm(undefined,{vehicleVariantId:VARIANT,vehicleYear:2020}));
   assert.equal(blockedResult.status,"error");
   assert.equal(blocked.calls.rpc.length,0);
   const accepted=harness(kind,{compatibility:{level:"unverified"}});
   try{await accepted.api.startCheckout({},webForm(undefined,{vehicleVariantId:VARIANT,vehicleYear:2020,compatibilityAcknowledged:"1"}));assert.fail("expected Stripe redirect");}catch(error){assert.match(error.message,/^redirect:/);}
   assert.equal(accepted.calls.rpc.length,1);
   const noVehicle=harness(kind);
   try{await noVehicle.api.startCheckout({},webForm(undefined));assert.fail("expected Stripe redirect");}catch(error){assert.match(error.message,/^redirect:/);}
   assert.equal(noVehicle.calls.compatibility.length,0);
   assert.equal(noVehicle.calls.rpc.length,1);
  }else{
   const blocked=harness(kind,{compatibility:{level:"unverified"}});
   const blockedResponse=await blocked.api.POST(mobileRequest(undefined,{variantId:VARIANT,year:2020}));
   assert.equal(blockedResponse.status,409);
   assert.equal(blocked.calls.rpc.length,0);
   const accepted=harness(kind,{compatibility:{level:"unverified"}});
   const acceptedResponse=await accepted.api.POST(mobileRequest(undefined,{variantId:VARIANT,year:2020,compatibilityAcknowledged:true}));
   assert.equal(acceptedResponse.status,201);
   assert.equal(accepted.calls.rpc.length,1);
   const noVehicle=harness(kind);
   const noVehicleResponse=await noVehicle.api.POST(mobileRequest(undefined));
   assert.equal(noVehicleResponse.status,201);
   assert.equal(noVehicle.calls.compatibility.length,0);
   assert.equal(noVehicle.calls.rpc.length,1);
  }
 });
}
