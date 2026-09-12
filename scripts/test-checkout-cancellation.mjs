import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as crypto from 'node:crypto';

const orderId='00000000-0000-4000-8000-000000000001';
const buyerId='00000000-0000-4000-8000-000000000002';
function fixture(options={}){
 const state={order:{id:orderId,buyer_id:buyerId,payment_status:'unpaid',provider_checkout_session_id:'cs_fixture'},stock:0,provider:'open',payment:'unpaid',reads:0,expires:0,events:[],diagnostics:[],...options};
 const session=()=>({id:'cs_fixture',status:state.provider,payment_status:state.payment,client_reference_id:orderId,metadata:{order_id:orderId},url:'https://checkout.example.test/session',payment_intent:null,amount_total:100,currency:'gbp'});
 const db={from(table){
  const filters=[];let update;
  const query={select(){return query;},eq(key,value){filters.push([key,value]);return query;},is(key,value){filters.push([key,value]);return query;},limit(){return query;},update(value){update=value;return query;},async maybeSingle(){return run();},then(resolve,reject){return Promise.resolve(run()).then(resolve,reject);}};
  function run(){
   if(table==='parts')return {data:{slug:'fixture-part',seller_id:'seller'},error:null};
   if(table==='order_items')return {data:{parts:{slug:'fixture-part'}},error:null};
   if(state.readError&&!update)return {data:null,error:{code:'offline'}};
   if(update&&state.beforeAttach)state.beforeAttach(state);
   if(update&&state.attachFailure)return {data:null,error:state.attachFailure==='error'?{code:'offline'}:null};
   const found=state.order&&filters.every(([k,v])=>state.order[k]===v);
   if(found&&update)Object.assign(state.order,update);
   return {data:found?{...state.order}:null,error:null};
  }return query;
 },async rpc(name,args){
  state.events.push(name);
  if(name==='prepare_checkout_order_v2')return {data:[{order_id:orderId,part_title:'Fixture',quantity:1,unit_price_pence:100,shipping_pence:0,checkout_expires_at:'2026-10-01T10:00:00Z'}],error:null};
  if(state.beforeCancel)state.beforeCancel(state);
  if(state.cancelError)return {data:null,error:{code:'offline'}};
  if(name==='cancel_checkout_order_if_session_matches'&&(state.order.buyer_id!==args.p_buyer_id||state.order.provider_checkout_session_id!==args.p_expected_session_id))return {data:false,error:null};
  if(['paid','processing'].includes(state.order.payment_status))return {data:false,error:null};
  if(state.order.payment_status!=='cancelled'){state.stock++;state.order.payment_status='cancelled';}
  return {data:true,error:null};
 }};
 const payments={isStripeCheckoutConfigured:()=>true,async createCheckoutSession(){if(state.createError)throw Error('private provider payload');if('createResponse' in state)return state.createResponse;return session();},async getCheckoutSession(){state.reads++;if(state.providerError)throw Error('private provider payload');if(state.duringProviderRead)state.duringProviderRead(state);return session();},async expireCheckoutSession(){state.expires++;if(state.expireRace){state.provider=state.expireRace;state.payment=state.expireRace==='complete'?'paid':'unpaid';throw Error('private provider payload');}state.provider='expired';return session();}};
 const cache={};
 payments.getCreatedCheckoutSessionId=session=>load('lib/stripe-payments').getCreatedCheckoutSessionId(session);
 function load(path){
  if(cache[path])return cache[path];
  const output=ts.transpileModule(fs.readFileSync(new URL('../src/'+path+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};cache[path]=exports;
  vm.runInNewContext(output,{exports,URL,Request,Response,console,require(name){
   if(name==='server-only')return {};
   if(name==='node:crypto')return crypto;
   if(name==='next/server')return {NextResponse:{redirect:(url)=>Response.redirect(url),json:(body,init)=>Response.json(body,init)}};
   if(name==='next/navigation')return {redirect:(url)=>{throw Error('REDIRECT:'+url);}};
   if(name==='@/lib/auth')return {getCurrentUser:async()=>state.unauthenticated?null:{id:buyerId},requireUser:async()=>({id:buyerId})};
   if(name==='@/lib/supabase/admin')return {createSupabaseAdminClient:()=>db};
   if(name==='@/lib/supabase/server')return {createSupabaseServerClient:async()=>db};
   if(name==='@/lib/stripe-connect')return {getAppUrl:()=> 'https://preview.example.test'};
   if(name==='@/lib/stripe-payments')return payments;
   if(name==='@/lib/push/schedule')return {schedulePushDispatch:()=>{}};
   if(name==='@/lib/ops-monitoring')return {reportOperationalError:async(value)=>{state.events.push(value.event);state.diagnostics.push({...value,error:value.error?.message});},reportOperationalWarning:()=>{}};
   if(name==='@/lib/seller-payment-sync')return {syncSellerPaymentAccount:async()=>({active:true})};
   if(name==='@/lib/data/compatibility')return {getPartCompatibility:async()=>null};
   if(name==='@/lib/commerce-reconciliation')return {reconcileStripeOrder:async()=>{state.events.push('reconcile');return {state:'deferred'};}};
   if(name==='@/lib/mobile-api')return {mobileOptions:()=>{},mobileJson:(_r,body,status=200)=>Response.json(body,{status}),requireMobileUser:async()=>state.unauthenticated?{response:Response.json({ok:false},{status:401})}:{context:{user:{id:buyerId},supabase:db}}};
   if(name.startsWith('@/'))return load(name.slice(2));
   throw Error('Unexpected dependency '+name);
  }});
  return exports;
 }
 return {state,load,async cancel(mobile=false){return mobile?load('app/api/mobile/v1/orders/[orderId]/checkout/route').DELETE(new Request('https://preview.example.test'),{params:Promise.resolve({orderId})}):load('app/checkout/cancel/route').GET(new Request('https://preview.example.test/checkout/cancel?order='+orderId));},async start(mobile=false){state.order.provider_checkout_session_id=null;if(mobile)return load('app/api/mobile/v1/checkout/route').POST(new Request('https://preview.example.test',{method:'POST',body:JSON.stringify({partId:orderId})}));const form=new FormData();form.set('partId',orderId);return load('app/checkout/actions').startCheckout({},form);}};
}

test('resume expired checkout cannot cancel a newer session or claim expired after CAS refusal',async()=>{
 const f=fixture({provider:'expired',beforeCancel:state=>{state.order.provider_checkout_session_id='cs_new';}});
 const form=new FormData();form.set('orderId',orderId);
 await assert.rejects(f.load('app/account/orders/checkout-actions').resumeCheckout(form),/checkout=pending/);
 assert.equal(f.state.stock,0);
});
test('resume expired checkout does not claim success after database cancellation error',async()=>{
 const f=fixture({provider:'expired',cancelError:true});const form=new FormData();form.set('orderId',orderId);
 await assert.rejects(f.load('app/account/orders/checkout-actions').resumeCheckout(form),/checkout=unavailable/);
 assert.equal(f.state.stock,0);
});

for(const status of ['cancelled','disputed','unknown','paid','partially_refunded','refunded','processing'])test('resume refuses payable URL for local '+status+' even with a stale submitted form',async()=>{
 const f=fixture();f.state.order.payment_status=status;const form=new FormData();form.set('orderId',orderId);
 await assert.rejects(f.load('app/account/orders/checkout-actions').resumeCheckout(form),/^Error: REDIRECT:\/account\/orders\//);
 assert.equal(f.state.reads,0);assert.equal(f.state.stock,0);
});
for(const status of ['unpaid','requires_action'])test('resume still returns open unpaid provider URL for local '+status,async()=>{
 const f=fixture();f.state.order.payment_status=status;const form=new FormData();form.set('orderId',orderId);
 await assert.rejects(f.load('app/account/orders/checkout-actions').resumeCheckout(form),/REDIRECT:https:\/\/checkout.example.test\/session/);
 assert.equal(f.state.stock,0);
});
for(const update of [{payment_status:'cancelled'},{payment_status:'disputed'},{provider_checkout_session_id:'cs_new'}])test('resume rechecks the local order after provider lookup '+JSON.stringify(update),async()=>{
 const f=fixture({duringProviderRead:state=>Object.assign(state.order,update)});const form=new FormData();form.set('orderId',orderId);
 await assert.rejects(f.load('app/account/orders/checkout-actions').resumeCheckout(form),/^Error: REDIRECT:\/account\/orders\//);
 assert.equal(f.state.stock,0);
});

for(const mobile of [false,true]){
 const label=mobile?'mobile':'web';
 test(label+' closes payable session before releasing stock and retry does not double release',async()=>{
  const f=fixture({beforeCancel:state=>assert.equal(state.provider,'expired','stock cannot be released while session is payable')});
  await f.cancel(mobile);assert.equal(f.state.stock,1);assert.equal(f.state.expires,1);
  await f.cancel(mobile);assert.equal(f.state.stock,1);
 });
 for(const options of [{provider:'complete',payment:'paid'},{provider:'complete'},{providerError:true},{expireRace:'complete'},{cancelError:true}])test(label+' refuses success for '+JSON.stringify(options),async()=>{
  const f=fixture(options);const response=await f.cancel(mobile);assert.equal(f.state.stock,0);
  if(mobile){assert.equal((await response.json()).ok,false);}else assert.doesNotMatch(response.headers.get('location'),/checkout=cancelled/);
 });
 test(label+' expiration race re-read allows confirmed expiry',async()=>{const f=fixture({expireRace:'expired'});await f.cancel(mobile);assert.equal(f.state.stock,1);assert.equal(f.state.reads,2);});
 test(label+' already expired session releases once without expire request',async()=>{const f=fixture({provider:'expired'});await f.cancel(mobile);assert.equal(f.state.stock,1);assert.equal(f.state.expires,0);});
 test(label+' ownership blocks provider access and cancellation',async()=>{const f=fixture();f.state.order.buyer_id='other';await f.cancel(mobile);assert.equal(f.state.stock,0);assert.equal(f.state.reads,0);});
 test(label+' concurrent new session survives stale cancellation',async()=>{const f=fixture({beforeCancel:state=>{state.order.provider_checkout_session_id='cs_new';}});const response=await f.cancel(mobile);assert.equal(f.state.stock,0);if(mobile)assert.equal((await response.json()).ok,false);else assert.doesNotMatch(response.headers.get('location'),/checkout=cancelled/);});
 for(const attachFailure of ['zero','error'])test(label+' failed attachment closes orphan and never exposes checkout URL '+attachFailure,async()=>{const f=fixture({attachFailure});const response=await f.start(mobile);assert.equal(f.state.provider,'expired');assert.equal(f.state.stock,1);if(mobile)assert.equal(response.status,503);else assert.equal(response.status,'error');});
 test(label+' uncertain creation keeps reservation and makes no release claim',async()=>{const f=fixture({createError:true});const response=await f.start(mobile);assert.equal(f.state.stock,0);if(!mobile)assert.doesNotMatch(response.message,/stock has been released/);});
 for(const createResponse of [{},{id:''},{id:123},{id:'invalid'},{id:'cs_'},null])test(label+' malformed creation result preserves reservation '+JSON.stringify(createResponse),async()=>{
  const f=fixture({createResponse});const response=await f.start(mobile);assert.equal(f.state.stock,0);assert.equal(f.state.reads,0);assert.equal(f.state.expires,0);
  if(mobile)assert.equal((await response.json()).reservationReleased,false);else assert.doesNotMatch(response.message,/stock has been released/);
 });
 test(label+' diagnostics identify failed creation stage without provider payload',async()=>{const f=fixture({createError:true});await f.start(mobile);assert.equal(f.state.diagnostics.at(-1).context.operation,'session_create');assert.doesNotMatch(JSON.stringify(f.state.diagnostics),/private provider payload/);});
 test(label+' diagnostics identify failed provider-close stage without provider payload',async()=>{const f=fixture({providerError:true});await f.cancel(mobile);assert.equal(f.state.diagnostics.at(-1).context.operation,'provider_close');assert.doesNotMatch(JSON.stringify(f.state.diagnostics),/private provider payload/);});
 test(label+' a historically cancelled order still closes its payable provider session',async()=>{const f=fixture();f.state.order.payment_status='cancelled';await f.cancel(mobile);assert.equal(f.state.provider,'expired');assert.equal(f.state.stock,0);});
 test(label+' ambiguous orphan expiry retains stock and rejects checkout URL',async()=>{const f=fixture({attachFailure:'zero',providerError:true});const response=await f.start(mobile);assert.equal(f.state.stock,0);if(mobile)assert.equal((await response.json()).reservationReleased,false);else assert.doesNotMatch(response.message,/stock has been released/);});
 test(label+' competing session attachment is not overwritten or cancelled',async()=>{const f=fixture({beforeAttach:state=>{state.order.provider_checkout_session_id='cs_new';}});await f.start(mobile);assert.equal(f.state.order.provider_checkout_session_id,'cs_new');assert.equal(f.state.stock,0);assert.equal(f.state.provider,'expired');});
 test(label+' confirmed attachment preserves stock and returns the payable URL',async()=>{const f=fixture();if(mobile){const r=await f.start(true);assert.equal(r.status,201);assert.equal((await r.json()).checkoutUrl,'https://checkout.example.test/session');}else await assert.rejects(f.start(false),/REDIRECT:https:\/\/checkout.example.test\/session/);assert.equal(f.state.order.provider_checkout_session_id,'cs_fixture');assert.equal(f.state.stock,0);assert.equal(f.state.expires,0);});
}
