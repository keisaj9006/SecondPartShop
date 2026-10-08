import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// Actual handlers/actions execute; the query adapter records intent, not real persistence/RLS.
const actor='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const part='33333333-3333-4333-8333-333333333333';
const seller='44444444-4444-4444-8444-444444444444';
const compiled=new Map();
function load(file,deps){
 if(!compiled.has(file))compiled.set(file,ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText);
 const exports={};vm.runInNewContext(compiled.get(file),{exports,Request,Response,URL,URLSearchParams,FormData,File,crypto,console,require(name){assert.ok(name in deps,'unexpected dependency '+name);return deps[name];}});return exports;
}
const plain=value=>JSON.parse(JSON.stringify(value));
function dbHarness(resolve=()=>({data:null,error:null})){
 const calls=[];
 const db={from(table){const call={table,operation:'select',filters:[]};calls.push(call);const q={
  select(columns,options){call.columns=columns;call.options=options;return q;},
  insert(value){call.operation='insert';call.value=plain(value);return q;},
  upsert(value,options){call.operation='upsert';call.value=plain(value);call.conflict=options?.onConflict;return q;},
  update(value){call.operation='update';call.value=plain(value);return q;},
  delete(){call.operation='delete';return q;},
  eq(key,value){call.filters.push(['eq',key,value]);return q;},
  neq(key,value){call.filters.push(['neq',key,value]);return q;},
  order(){return q;},limit(){return q;},range(){return q;},
  maybeSingle:async()=>resolve(call),single:async()=>resolve(call),then:(yes,no)=>Promise.resolve(resolve(call)).then(yes,no)
 };return q;},rpc:async(name,args)=>{const call={operation:'rpc',name,args:plain(args??{})};calls.push(call);return resolve(call);}};
 return {db,calls};
}
function mobile(db,{signedIn=true,terms=true}={}){
 const context={user:{id:actor,email_confirmed_at:'2026-01-01'},supabase:db};
 const denied={context:null,response:Response.json({error:'unauthorized'},{status:401}),seller:null};
 return {mobileJson:(_r,body,status=200)=>Response.json(body,{status}),mobileOptions:()=>new Response(null,{status:204}),requireMobileUser:async()=>signedIn?{context,response:null}:denied,requireMobileSeller:async()=>signedIn?{context,seller:{id:seller},response:null}:denied,mobileMarketplaceTermsAccepted:async()=>terms};
}
const post=(body,path='/api/test')=>new Request('https://preview.example.test'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const uuid={isUuid:value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)};

for(const existing of [false,true])test('saved-part '+(existing?'removal':'creation')+' binds all reads/writes to authenticated viewer',async()=>{
 const h=dbHarness(call=>({data:call.operation==='select'&&existing?{part_id:part}:null,error:null}));
 const subject=load('src/app/api/mobile/v1/saved/route.ts',{'@/lib/mobile-api':mobile(h.db),'@/lib/identifiers':uuid,'@/lib/data/marketplace':{getListingCardsByIds:async()=>[]}});
 const response=await subject.POST(post({partId:part,profileId:other}));assert.equal(response.status,existing?200:201);assert.equal((await response.json()).saved,!existing);
 assert.deepEqual(h.calls[0].filters,[['eq','profile_id',actor],['eq','part_id',part]]);
 if(existing)assert.deepEqual(h.calls[1].filters,h.calls[0].filters);else assert.deepEqual(h.calls[1].value,{profile_id:actor,part_id:part});
});
test('saved-part mutation refuses anonymous/invalid input and reports write failure',async()=>{
 for(const scenario of ['anonymous','invalid','write-error']){
  const h=dbHarness(call=>({data:null,error:call.operation==='insert'?{message:'private database details'}:null}));
  const subject=load('src/app/api/mobile/v1/saved/route.ts',{'@/lib/mobile-api':mobile(h.db,{signedIn:scenario!=='anonymous'}),'@/lib/identifiers':uuid,'@/lib/data/marketplace':{getListingCardsByIds:async()=>[]}});
  const response=await subject.POST(post({partId:scenario==='invalid'?'bad':part}));assert.equal(response.status,{anonymous:401,invalid:400,'write-error':503}[scenario]);
  if(scenario!=='write-error')assert.equal(h.calls.length,0);else assert.equal((await response.json()).error,'save_failed');
 }
});
test('recent-view retries use owner/part conflict key and ignore supplied profile identity',async()=>{
 const h=dbHarness(()=>({error:null}));const subject=load('src/app/api/recently-viewed/route.ts',{'next/server':{NextResponse:Response},'@/lib/auth':{getCurrentUser:async()=>({id:actor})},'@/lib/supabase/server':{createSupabaseServerClient:async()=>h.db}});
 for(let i=0;i<2;i++)assert.equal((await subject.POST(post({partId:part,profileId:other}))).status,200);
 assert.equal(h.calls.length,2);for(const call of h.calls){assert.equal(call.operation,'upsert');assert.equal(call.conflict,'profile_id,part_id');assert.equal(call.value.profile_id,actor);assert.equal(call.value.part_id,part);}
});
test('recent-view anonymous, malformed and database failures never report a successful write',async()=>{
 for(const scenario of ['anonymous','invalid','database']){
  const h=dbHarness(()=>({error:{message:'private database details'}}));const subject=load('src/app/api/recently-viewed/route.ts',{'next/server':{NextResponse:Response},'@/lib/auth':{getCurrentUser:async()=>scenario==='anonymous'?null:{id:actor}},'@/lib/supabase/server':{createSupabaseServerClient:async()=>h.db}});
  const response=await subject.POST(post({partId:scenario==='invalid'?'bad':part}));assert.equal(response.status,{anonymous:401,invalid:400,database:500}[scenario]);assert.equal((await response.json()).ok,false);if(scenario!=='database')assert.equal(h.calls.length,0);
 }
});
function sellAction(h){return load('src/app/sell/actions.ts',{'next/cache':{revalidatePath(){}},'next/navigation':{redirect(url){throw Object.assign(new Error('redirect'),{url});}},'@/lib/auth':{requireUser:async()=>({id:actor})},'@/lib/supabase/server':{createSupabaseServerClient:async()=>h.db}});}
test('enable selling upgrades only the current buyer and cannot overwrite admin/seller role',async()=>{
 const h=dbHarness(()=>({data:{role:'seller'},error:null}));await assert.rejects(sellAction(h).enableSelling(),e=>e.url==='/dashboard?upgraded=1');
 assert.deepEqual(h.calls[0].value,{role:'seller'});assert.deepEqual(h.calls[0].filters,[['eq','id',actor],['eq','role','buyer']]);
});
for(const role of ['seller','admin',null])test('enable selling no-op preserves '+role+' role and routes explicitly',async()=>{
 const h=dbHarness(call=>({data:call.operation==='update'?null:role?{role}:null,error:null}));await assert.rejects(sellAction(h).enableSelling(),e=>e.url===(role?'/dashboard':'/sell?error=upgrade'));assert.equal(h.calls.filter(c=>c.operation==='update').length,1);
});
function readiness({failed=null,onboarding='complete',transfers=true,active=1,kind='breaker'}={}){
 const h=dbHarness(call=>{
  if(call.table===failed)return {data:null,error:{message:'private database details'}};
  if(call.table==='sellers')return {data:{id:seller,business_name:'Fixture',seller_type:'business',business_kind:kind},error:null};
  if(call.table==='seller_payment_accounts')return {data:{onboarding_status:onboarding,transfers_enabled:transfers,payouts_enabled:false,details_submitted:true},error:null};
  return {data:null,count:call.table==='parts'?active:0,error:null};
 });const subject=load('src/app/api/mobile/v1/seller/readiness/route.ts',{'@/lib/mobile-api':mobile(h.db)});return {h,subject};
}
for(const failed of ['sellers','seller_payment_accounts','parts','donor_vehicles','seller_verification_requests'])test('seller readiness '+failed+' failure is unavailable rather than false-ready',async()=>{
 const {subject}=readiness({failed});const r=await subject.GET(new Request('https://preview.example.test'));assert.equal(r.status,503);assert.equal((await r.json()).error,'seller_readiness_unavailable');
});
for(const [label,options,checkoutReady,marketReady] of [['ready',{},true,true],['onboarding',{onboarding:'pending'},false,false],['transfer-disabled',{transfers:false},false,false],['no-active-listings',{active:0},true,false],['missing-business-kind',{kind:null},true,false]])test('seller readiness distinguishes '+label+' gate',async()=>{
 const {h,subject}=readiness(options);const r=await subject.GET(new Request('https://preview.example.test'));assert.equal(r.status,200);const data=await r.json();assert.equal(data.readiness.checkoutReady,checkoutReady);assert.equal(data.readiness.marketReady,marketReady);
 for(const call of h.calls)assert.ok(call.filters.some(([,key,value])=>['id','seller_id'].includes(key)&&value===seller));
});
function dashboard(h,overrides={}){return load('src/app/dashboard/actions.ts',{'@/lib/part-image-cleanup':{},'@/lib/ops-monitoring':{},'next/cache':{revalidatePath(){}},'next/navigation':{},'@/lib/auth':{requireSeller:async()=>({user:{id:actor}})},'@/lib/supabase/server':{createSupabaseServerClient:async()=>h.db},'@/lib/data/marketplace':{getSellerForOwner:async id=>{assert.equal(id,actor);return {id:seller};}},'@/lib/image-upload':{},'@/lib/seller-business':{},'@/lib/identifiers':uuid,'@/lib/data/checkout':{},'@/lib/seller-geo':{},'@/lib/push/schedule':{},'@/lib/marketplace-policy':{},...overrides});}
for(const [status,stock,next] of [['active',0,'sold'],['sold',2,'draft'],['draft',3,'draft']])test('stock change '+status+' to '+next+' keeps ownership and reservation race guard',async()=>{
 const h=dbHarness(()=>({data:{status},error:null}));const f=new FormData();f.set('partId',part);f.set('stock',stock);await dashboard(h).updateStock(f);
 const update=h.calls.find(c=>c.operation==='update');assert.deepEqual(update.value,{stock,status:next});assert.deepEqual(update.filters,[['eq','id',part],['eq','seller_id',seller],['neq','status','reserved']]);
});
for(const action of ['updateStock','archiveListing'])test(action+' refuses reserved or missing/foreign listing',async()=>{
 for(const status of ['reserved',null]){const h=dbHarness(()=>({data:status?{status}:null,error:null}));const f=new FormData();f.set('partId',part);f.set('stock','2');await dashboard(h)[action](f);assert.equal(h.calls.filter(c=>c.operation==='update').length,0);assert.deepEqual(h.calls[0].filters,[['eq','id',part],['eq','seller_id',seller]]);}
});
test('unpublish archives owned active listing with concurrent reservation guard',async()=>{
 const h=dbHarness(()=>({data:{status:'active'},error:null}));const f=new FormData();f.set('partId',part);await dashboard(h).archiveListing(f);const update=h.calls.find(c=>c.operation==='update');assert.deepEqual(update.value,{status:'archived'});assert.ok(update.filters.some(x=>x[0]==='neq'&&x[1]==='status'&&x[2]==='reserved'));
});
for(const [message,error] of [['Already reviewed','already_reviewed'],['Paused while a transaction case is active','review_paused_by_case'],['Requires a completed, non-refunded transaction','review_not_ready']])test('review eligibility remains RPC-authoritative: '+error,async()=>{
 const h=dbHarness(()=>({data:null,error:{message}}));const subject=load('src/app/api/mobile/v1/reviews/route.ts',{'@/lib/mobile-api':mobile(h.db)});const r=await subject.POST(post({orderItemId:part,overall:5,reviewerId:other}));assert.equal(r.status,409);assert.equal((await r.json()).error,error);assert.equal(h.calls[0].name,'submit_transaction_review');assert.equal(h.calls[0].args.p_order_item_id,part);assert.equal('reviewerId' in h.calls[0].args,false);
});
for(const [message,error,status] of [['Purchase not found','forbidden',403],['Already open','case_already_open',409],['Already closed','transaction_closed',409],['Cancellation only before dispatch','cancellation_window_closed',409]])test('case eligibility remains RPC-authoritative: '+error,async()=>{
 const h=dbHarness(()=>({data:null,error:{message}}));let pushes=0;const subject=load('src/app/api/mobile/v1/cases/route.ts',{'@/lib/mobile-api':mobile(h.db),'@/lib/identifiers':uuid,'@/lib/supabase/admin':{createSupabaseAdminClient(){throw Error('POST must not use privileged identity lookup');}},'@/lib/push/schedule':{schedulePushDispatch(){pushes++;}}});const r=await subject.POST(post({orderItemId:part,caseType:'return',reason:'Does not fit',details:'A synthetic case explanation',buyerId:other}));assert.equal(r.status,status);assert.equal((await r.json()).error,error);assert.equal(pushes,0);assert.equal(h.calls[0].name,'open_transaction_case');assert.equal('buyerId' in h.calls[0].args,false);
});
const profileInput={businessName:'Fixture recycling',location:'Fixture town',description:'Synthetic recycler profile for local route behavior',sellerType:'private',owner_id:other,role:'admin'};
function profileRoute(h,options={}){return load('src/app/api/mobile/v1/seller/profile/route.ts',{'@/lib/mobile-api':mobile(h.db,options),'@/lib/seller-business':{isSellerBusinessKind:kind=>['breaker','atf','garage'].includes(kind)},'@/lib/seller-geo':{sellerGeoFromPostcode:async()=>({postcode:null}),persistSellerGeo:async()=>{}}});}
test('seller profile creation upgrades only buyer then binds new seller to authenticated identity',async()=>{
 const h=dbHarness(call=>({data:call.operation==='rpc'?true:call.table==='profiles'?{role:'buyer'}:call.operation==='insert'?{id:seller}:null,error:null}));
 const r=await profileRoute(h).POST(post(profileInput));assert.equal(r.status,201);const upgrade=h.calls.find(c=>c.operation==='rpc');assert.equal(upgrade.name,'upgrade_account_to_seller');assert.deepEqual(upgrade.args,{});const insert=h.calls.find(c=>c.operation==='insert');assert.equal(insert.value.owner_id,actor);assert.equal(insert.value.role,undefined);assert.ok(h.calls.indexOf(upgrade)<h.calls.indexOf(insert));
});
test('seller profile retry returns existing owned seller without second upgrade or insert',async()=>{
 const h=dbHarness(()=>({data:{id:seller},error:null}));const r=await profileRoute(h).POST(post(profileInput));assert.equal(r.status,200);assert.equal((await r.json()).existing,true);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].filters,[['eq','owner_id',actor]]);
});
for(const scenario of ['terms','missing-profile','upgrade-failure'])test('seller creation '+scenario+' refuses before creating inventory authority',async()=>{
 const h=dbHarness(call=>({data:call.table==='profiles'&&scenario!=='missing-profile'?{role:'buyer'}:call.operation==='rpc'?false:null,error:null}));
 const r=await profileRoute(h,{terms:scenario!=='terms'}).POST(post(profileInput));assert.equal(r.status,{terms:428,'missing-profile':503,'upgrade-failure':409}[scenario]);assert.equal(h.calls.filter(c=>c.operation==='insert').length,0);if(scenario==='terms')assert.equal(h.calls.length,0);
});
test('seller profile edit preserves owner filters and does not trust client verification or role',async()=>{
 const h=dbHarness(call=>({data:call.operation==='update'?{id:seller,verified_at:null,seller_type:'private',business_name:'Fixture recycling'}:{id:seller,verified_at:null},error:null}));
 const r=await profileRoute(h).PATCH(post({...profileInput,verified_at:'2026-01-01'}));assert.equal(r.status,200);const update=h.calls.find(c=>c.operation==='update');assert.deepEqual(update.filters,[['eq','id',seller],['eq','owner_id',actor]]);for(const field of ['owner_id','role','verified_at'])assert.equal(update.value[field],undefined);
});

test('twenty saved Garage vehicles retain all rows while exactly one current selection switches or clears',()=>{
 const jsx=(type,props,key)=>({type,props:props??{},key});const control=()=>null;let selection={kind:'garage',garageVehicleId:'vehicle-0',fitOnly:true};const vehicles=Array.from({length:20},(_,i)=>({id:'vehicle-'+i,make:'Fixture',modelFamily:'Model '+i,year:2020}));
 const context=load('src/lib/vehicle-context.ts',{});
 const subject=load('src/components/garage-vehicle-list.tsx',{'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:Symbol('Fragment')},react:{useEffect(){},useSyncExternalStore:()=>JSON.stringify(selection)},'next/link':'a','lucide-react':{CarFront:()=>null},'@/components/garage-vehicle-remove-form':{GarageVehicleRemoveForm:()=>null},'@/components/garage-vehicle-use-control':{GarageVehicleUseControl:control},'@/components/vehicle-visual':{VehicleVisual:()=>null},'@/lib/vehicle-context':{...context,EMPTY_VEHICLE_CONTEXT_SNAPSHOT:'empty',readStoredVehicleContext:()=>selection?{viewerId:actor,selection}:null,writeStoredVehicleContext:(viewer,next)=>{assert.equal(viewer,actor);selection=next;},clearStoredVehicleContext:()=>{selection=null;}}});
 const nodes=tree=>{const found=[];function visit(value){if(Array.isArray(value))return value.forEach(visit);if(!value||typeof value!=='object')return;found.push(value);visit(value.props?.children);}visit(tree);return found;};
 const render=()=>nodes(subject.GarageVehicleList({vehicles,viewerId:actor}));let tree=render();const controls=()=>tree.filter(n=>n.type===control);
 assert.equal(tree.filter(n=>n.type==='article').length,20);assert.equal(controls().filter(n=>n.props.isCurrent).length,1);assert.equal(controls()[0].props.isCurrent,true);
 controls()[19].props.onUse();tree=render();assert.equal(controls().filter(n=>n.props.isCurrent).length,1);assert.equal(controls()[19].props.isCurrent,true);assert.equal(vehicles.length,20);
 controls()[19].props.onFitChange(false);tree=render();assert.equal(controls()[19].props.fitOnly,false);
 tree.find(n=>n.type==='a'&&n.props.children==='Browse without a vehicle').props.onClick();tree=render();assert.equal(controls().filter(n=>n.props.isCurrent).length,0);assert.equal(tree.filter(n=>n.type==='article').length,20);
});




for(const action of ['createListing','updateListing'])for(const ready of [false,true])test(action+' publication '+(ready?'waits for dependencies before active':'requires checkout readiness before any writes'),async()=>{
 const h=dbHarness(call=>({data:call.table==='categories'?{is_selectable:true}:call.table==='parts'?{id:part,slug:'fixture-part',status:'draft'}:null,count:call.table==='part_images'?1:undefined,error:null}));
 h.db.storage={from:()=>({upload:async(path)=>{h.calls.push({operation:'upload',path});return{error:null};}})};
 const actions=dashboard(h,{'next/navigation':{redirect(url){throw Object.assign(new Error('redirect'),{url});}},'@/lib/data/checkout':{isSellerCheckoutReady:async id=>{assert.equal(id,seller);return ready;}},'@/lib/image-upload':{validateImageUpload:async()=>({extension:'png',mimeType:'image/png'})},'@/lib/part-image-cleanup':{requirePartImageCleanupReady:async()=>{}},'@/lib/marketplace-policy':{hasCurrentMarketplaceTerms:async()=>true},'@/lib/push/schedule':{schedulePushDispatch(){}}});
 const form=new FormData();for(const [key,value]of Object.entries({partId:part,title:'Fixture alternator',description:'A sufficiently detailed synthetic listing',categoryId:'fixture-category',condition:'used',price:'20',stock:'1',status:'active',oemNumber:'SYNTHETIC-OE',catalogueFitments:'[]'}))form.set(key,value);if(action==='createListing')form.set('images',new File(['validated-image-stub'],'fixture.png',{type:'image/png'}));
 if(!ready){const result=await actions[action]({status:'idle'},form);assert.equal(result.status,'error');assert.match(result.message,/Payments & Payouts/);assert.equal(h.calls.filter(c=>['insert','update','upload','rpc'].includes(c.operation)).length,0);return;}
 await assert.rejects(actions[action]({status:'idle'},form),e=>e.url===(action==='createListing'?'/dashboard?created=1':'/dashboard?updated=1'));
 const writes=h.calls.filter(c=>c.table==='parts'&&['insert','update'].includes(c.operation));assert.equal(writes[0].value.status,'draft');assert.equal(writes.at(-1).value.status,'active');assert.deepEqual(writes.at(-1).filters,[['eq','id',part],['eq','seller_id',seller]]);
 const publishIndex=h.calls.indexOf(writes.at(-1));assert.ok(h.calls.findIndex(c=>c.name==='replace_part_catalogue_fitments')<publishIndex);if(action==='createListing'){assert.ok(h.calls.findIndex(c=>c.operation==='upload')<publishIndex);assert.ok(h.calls.findIndex(c=>c.table==='part_images'&&c.operation==='insert')<publishIndex);}
});
