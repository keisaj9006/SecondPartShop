import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");
const jsxRuntime={
 Fragment:Symbol("Fragment"),
 jsx:(type,props,key)=>({type,props:props??{},key:key??null}),
 jsxs:(type,props,key)=>({type,props:props??{},key:key??null})
};
const icon=()=>null;

function moduleFrom(relativePath,dependencies={},globals={}){
 const source=fs.readFileSync(path.join(root,relativePath),"utf8");
 const compiled=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
 }).outputText;
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  require(name){
   if(name==="react/jsx-runtime")return jsxRuntime;
   if(name==="lucide-react")return new Proxy({},{get:()=>icon});
   if(name in dependencies)return dependencies[name];
   throw new Error(`Unexpected dependency ${name} in ${relativePath}`);
  },
  URL,URLSearchParams,console,...globals
 });
 return exports;
}

const {safeInternalPath}=moduleFrom("src/lib/navigation.ts");

class BrowserWindow {
 constructor(pathname="/",search="",hash=""){
  this.location={pathname,search,hash};
  this.listeners=new Map();
 }
 addEventListener(type,listener){
  const listeners=this.listeners.get(type)??new Set();
  listeners.add(listener);
  this.listeners.set(type,listeners);
 }
 removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);}
 dispatchEvent(event){for(const listener of this.listeners.get(event.type)??[])listener(event);return true;}
 listenerCount(){return [...this.listeners.values()].reduce((count,listeners)=>count+listeners.size,0);}
}

class TestCustomEvent {
 constructor(type,init={}){this.type=type;this.detail=init.detail;}
}

function hookRunner(){
 const state=[];
 const refs=[];
 const effectDeps=[];
 const effectCleanups=[];
 let hookIndex=0;
 let pendingEffects=[];
 let transitionPending=false;
 const transitions=[];
 const react={
  useState(initial){
   const index=hookIndex++;
   if(!(index in state))state[index]=typeof initial==="function"?initial():initial;
   return [state[index],value=>{state[index]=typeof value==="function"?value(state[index]):value;}];
  },
  useRef(initial){const index=hookIndex++;if(!(index in refs))refs[index]={current:initial};return refs[index];},
  useEffect(effect,deps){
   const index=hookIndex++;
   const previous=effectDeps[index];
   const changed=!previous||!deps||deps.length!==previous.length||deps.some((value,position)=>!Object.is(value,previous[position]));
   if(changed){
    effectDeps[index]=deps;
    pendingEffects.push(()=>{
     effectCleanups[index]?.();
     effectCleanups[index]=effect()??undefined;
    });
   }
  },
  useTransition(){
   hookIndex++;
   return [transitionPending,callback=>{
    transitionPending=true;
    const transition=Promise.resolve().then(callback).finally(()=>{transitionPending=false;});
    transitions.push(transition);
   }];
  }
 };
 return {
  react,
  navigation:{useRouter:()=>this.router},
  router:{pushes:[],refreshes:0,push(value){this.pushes.push(value);},refresh(){this.refreshes++;}},
  render(component,props){hookIndex=0;pendingEffects=[];return component(props);},
  flushEffects(){const effects=pendingEffects;pendingEffects=[];effects.forEach(effect=>effect());},
  async flushTransitions(){await Promise.allSettled(transitions.splice(0));await new Promise(resolve=>setImmediate(resolve));},
  unmount(){effectCleanups.forEach(cleanup=>cleanup?.());}
 };
}

function nodes(tree){
 const found=[];
 const visit=value=>{
  if(value===null||value===undefined||typeof value==="boolean")return;
  if(Array.isArray(value)){value.forEach(visit);return;}
  if(typeof value!=="object")return;
  found.push(value);
  visit(value.props?.children);
 };
 visit(tree);
 return found;
}

function textContent(value){
 if(value===null||value===undefined||typeof value==="boolean")return "";
 if(Array.isArray(value))return value.map(textContent).join("");
 if(typeof value==="object")return textContent(value.props?.children);
 return String(value);
}

function findButton(tree){
 const button=nodes(tree).find(node=>node.type==="button");
 assert.ok(button,"Expected SaveButton to render a button");
 return button;
}

function statusText(tree){
 return textContent(nodes(tree).find(node=>node.props?.role==="status")??"");
}

function loadSaveButton({browserWindow,action}){
 const runner=hookRunner();
 runner.navigation.useRouter=()=>runner.router;
 const {SaveButton}=moduleFrom("src/components/save-button.tsx",{
  react:runner.react,
  "next/navigation":runner.navigation,
  "@/app/saved/actions":{toggleSavedPart:action},
  "@/lib/navigation":{safeInternalPath}
 },{window:browserWindow,CustomEvent:TestCustomEvent});
 return {runner,SaveButton};
}

test("successful add and remove synchronize two mounted copies from the action result",async()=>{
 const browserWindow=new BrowserWindow("/","?q=DSG","#marketplace");
 const responses=[{ok:true,authRequired:false,saved:true},{ok:true,authRequired:false,saved:false}];
 const action=async()=>responses.shift();
 const first=loadSaveButton({browserWindow,action});
 const second=loadSaveButton({browserWindow,action});
 let firstTree=first.runner.render(first.SaveButton,{partId:"part-1",initialSaved:false,compact:true});
 let secondTree=second.runner.render(second.SaveButton,{partId:"part-1",initialSaved:false,compact:true});
 first.runner.flushEffects();second.runner.flushEffects();

 findButton(firstTree).props.onClick();
 await first.runner.flushTransitions();
 firstTree=first.runner.render(first.SaveButton,{partId:"part-1",initialSaved:false,compact:true});
 secondTree=second.runner.render(second.SaveButton,{partId:"part-1",initialSaved:false,compact:true});
 assert.equal(findButton(firstTree).props["aria-pressed"],true);
 assert.equal(findButton(secondTree).props["aria-pressed"],true);
 assert.equal(statusText(firstTree),"Part saved.");
 assert.equal(statusText(secondTree),"Part saved.");
 assert.equal(first.runner.router.refreshes,1);

 findButton(secondTree).props.onClick();
 await second.runner.flushTransitions();
 firstTree=first.runner.render(first.SaveButton,{partId:"part-1",initialSaved:false,compact:true});
 secondTree=second.runner.render(second.SaveButton,{partId:"part-1",initialSaved:false,compact:true});
 assert.equal(findButton(firstTree).props["aria-pressed"],false);
 assert.equal(findButton(secondTree).props["aria-pressed"],false);
 assert.equal(statusText(firstTree),"Part removed from saved parts.");
 assert.equal(statusText(secondTree),"Part removed from saved parts.");
 assert.equal(second.runner.router.refreshes,1);
});

test("ok=false and thrown actions preserve the original state and never change another copy",async()=>{
 const browserWindow=new BrowserWindow("/parts/dsg");
 const actions=[async()=>({ok:false,authRequired:false,saved:false,message:"raw database detail"}),async()=>{throw new Error("provider secret");}];
 const stable=loadSaveButton({browserWindow,action:async()=>({ok:true,authRequired:false,saved:false})});
 let stableTree=stable.runner.render(stable.SaveButton,{partId:"part-1",initialSaved:true});
 stable.runner.flushEffects();

 for(const action of actions){
  const subject=loadSaveButton({browserWindow,action});
  let tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:true});
  subject.runner.flushEffects();
  findButton(tree).props.onClick();
  await subject.runner.flushTransitions();
  tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:true});
  stableTree=stable.runner.render(stable.SaveButton,{partId:"part-1",initialSaved:true});
  assert.equal(findButton(tree).props["aria-pressed"],true);
  assert.equal(findButton(stableTree).props["aria-pressed"],true);
  assert.equal(statusText(tree),"We couldn't update your saved parts. Please try again.");
  assert.doesNotMatch(textContent(tree),/raw database detail|provider secret/);
  assert.equal(subject.runner.router.refreshes,0);
 }
});

test("compact failures render visible retry guidance inside a non-interactive card-safe overlay",async()=>{
 const browserWindow=new BrowserWindow("/");
 const subject=loadSaveButton({browserWindow,action:async()=>({ok:false,authRequired:false,saved:false,message:"raw database detail"})});
 let tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false,compact:true});
 subject.runner.flushEffects();
 findButton(tree).props.onClick();
 await subject.runner.flushTransitions();
 tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false,compact:true});
 const visibleRetry=nodes(tree).find(node=>textContent(node)==="Save failed. Try again."&&node.props?.["aria-hidden"]==="true");
 assert.ok(visibleRetry,"Expected compact failure to render visible retry guidance");
 assert.doesNotMatch(visibleRetry.props.className,/\bsr-only\b/);
 assert.match(visibleRetry.props.className,/\babsolute\b/);
 assert.match(visibleRetry.props.className,/\bpointer-events-none\b/);
 assert.equal(statusText(tree),"We couldn't update your saved parts. Please try again.");
});

test("auth-required save returns to the exact safe page and rejects an unsafe destination",async()=>{
 for(const scenario of [
  {pathname:"/parts/dsg-solenoid",search:"?q=DSG&cv=vehicle-1",hash:"#fit",expected:"/parts/dsg-solenoid?q=DSG&cv=vehicle-1#fit"},
  {pathname:"//evil.example",search:"?steal=1",hash:"#x",expected:"/"}
 ]){
  let calls=0;
  const browserWindow=new BrowserWindow(scenario.pathname,scenario.search,scenario.hash);
  const subject=loadSaveButton({browserWindow,action:async()=>{calls++;return {ok:false,authRequired:true,saved:false,message:"Sign in"};}});
  let tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false});
  subject.runner.flushEffects();
  findButton(tree).props.onClick();
  await subject.runner.flushTransitions();
  tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false});
  assert.equal(subject.runner.router.pushes[0],`/account?returnTo=${encodeURIComponent(scenario.expected)}`);
  assert.equal(calls,1);
  assert.equal(findButton(tree).props["aria-pressed"],false);
  assert.equal(subject.runner.router.refreshes,0);
 }
});

test("pending state is exposed and repeated activation is guarded until completion",async()=>{
 let resolve;
 const held=new Promise(done=>{resolve=done;});
 let calls=0;
 const browserWindow=new BrowserWindow("/");
 const subject=loadSaveButton({browserWindow,action:async()=>{calls++;return held;}});
 let tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false});
 subject.runner.flushEffects();
 const originalHandler=findButton(tree).props.onClick;
 originalHandler();
 originalHandler();
 await new Promise(resolveImmediate=>setImmediate(resolveImmediate));
 tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false});
 assert.equal(calls,1);
 assert.equal(findButton(tree).props.disabled,true);
 assert.equal(findButton(tree).props["aria-busy"],true);
 assert.equal(findButton(tree).props["aria-label"],"Saving part");
 assert.equal(statusText(tree),"Saving part…");
 resolve({ok:true,authRequired:false,saved:true});
 await subject.runner.flushTransitions();
 tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false});
 assert.equal(findButton(tree).props.disabled,false);
 assert.equal(findButton(tree).props["aria-pressed"],true);
});

test("viewer identity resets mounted local saved state while the same viewer keeps it",async()=>{
 const browserWindow=new BrowserWindow("/");
 const subject=loadSaveButton({browserWindow,action:async()=>({ok:true,authRequired:false,saved:true})});
 let tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false,viewerId:"viewer-a"});
 subject.runner.flushEffects();
 findButton(tree).props.onClick();
 await subject.runner.flushTransitions();

 tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false,viewerId:"viewer-a"});
 assert.equal(findButton(tree).props["aria-pressed"],true,"same-viewer refresh must preserve the action result while the server prop is stale");
 assert.equal(statusText(tree),"Part saved.");

 tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false,viewerId:"viewer-b"});
 assert.equal(findButton(tree).props["aria-pressed"],false,"a different viewer must receive that viewer's authoritative initial state");
 assert.equal(findButton(tree).props.disabled,false);
 assert.equal(statusText(tree),"");
});

test("a save completing after its viewer boundary unmounts cannot update the next viewer",async()=>{
 let resolveOldAction;
 const held=new Promise(resolve=>{resolveOldAction=resolve;});
 const browserWindow=new BrowserWindow("/");
 const oldViewer=loadSaveButton({browserWindow,action:async()=>held});
 const nextViewer=loadSaveButton({browserWindow,action:async()=>({ok:true,authRequired:false,saved:true})});
 let oldTree=oldViewer.runner.render(oldViewer.SaveButton,{partId:"part-1",initialSaved:false,viewerId:"viewer-a"});
 oldViewer.runner.flushEffects();
 findButton(oldTree).props.onClick();
 await new Promise(resolve=>setImmediate(resolve));
 oldViewer.runner.unmount();

 let nextTree=nextViewer.runner.render(nextViewer.SaveButton,{partId:"part-1",initialSaved:false,viewerId:"viewer-b"});
 nextViewer.runner.flushEffects();
 assert.equal(findButton(nextTree).props.disabled,false);
 assert.equal(findButton(nextTree).props["aria-busy"],false);
 resolveOldAction({ok:true,authRequired:false,saved:true});
 await oldViewer.runner.flushTransitions();
 nextTree=nextViewer.runner.render(nextViewer.SaveButton,{partId:"part-1",initialSaved:false,viewerId:"viewer-b"});

 assert.equal(findButton(nextTree).props["aria-pressed"],false);
 assert.equal(statusText(nextTree),"");
 assert.equal(oldViewer.runner.router.refreshes,0);
 assert.equal(nextViewer.runner.router.refreshes,0);
});

test("fresh server props rebase state, stale unchanged props do not resurrect old state, and subscriptions clean up",async()=>{
 const browserWindow=new BrowserWindow("/");
 const subject=loadSaveButton({browserWindow,action:async()=>({ok:true,authRequired:false,saved:true})});
 let tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false});
 subject.runner.flushEffects();
 assert.equal(browserWindow.listenerCount(),1);
 findButton(tree).props.onClick();
 await subject.runner.flushTransitions();
 tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false});
 subject.runner.flushEffects();
 tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false});
 assert.equal(findButton(tree).props["aria-pressed"],true);

 tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:true});
 subject.runner.flushEffects();
 tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:true});
 assert.equal(findButton(tree).props["aria-pressed"],true);
 tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false});
 subject.runner.flushEffects();
 tree=subject.runner.render(subject.SaveButton,{partId:"part-1",initialSaved:false});
 assert.equal(findButton(tree).props["aria-pressed"],false);

 subject.runner.unmount();
 assert.equal(browserWindow.listenerCount(),0);
});

test("part detail empty fitments render context-aware guidance with and without selected-vehicle evidence",async()=>{
 const listing={
  id:"part-1",slug:"dsg-solenoid",title:"DSG Solenoid Repair Set",description:"Test listing",condition:"used",
  pricePence:12500,shippingPence:0,stock:1,collectionAvailable:false,deliveryDaysMin:null,deliveryDaysMax:null,
  images:[],fitments:[],oemNumber:null,manufacturer:null,partNumber:null,gearboxFamily:null,gearboxCode:null,
  category:{isTransmissionRelated:false},sellerId:"seller-1",
  seller:{ownerId:"owner-1",slug:"qa-seller",verified:true,sellerType:"professional",location:"Edinburgh",businessName:"QA Seller"}
 };
 const component=()=>null;
 let compatibility=null;
 let catalogueSelection=null;
 const {default:PartPage}=moduleFrom("src/app/parts/[slug]/page.tsx",{
  "next/navigation":{notFound(){throw new Error("Unexpected notFound");}},"next/link":"a",
  "@/components/ask-seller-form":{AskSellerForm:component},"@/components/buy-now-form":{BuyNowForm:component},
  "@/components/compatibility-badge":{CompatibilityBadge:component},"@/components/header":{Header:component},
  "@/components/marketplace-user-block-button":{MarketplaceUserBlockButton:component},"@/components/product-gallery":{ProductGallery:component},
  "@/components/part-passport":{PartPassport:component},"@/components/save-button":{SaveButton:component},
  "@/components/recently-viewed-tracker":{RecentlyViewedTracker:component},"@/lib/auth":{getCurrentUser:async()=>null},
  "@/lib/data/compatibility":{getPartCompatibility:async()=>compatibility},"@/lib/data/checkout":{isSellerCheckoutReady:async()=>false},
  "@/lib/data/marketplace":{getSavedPartIdsForParts:async()=>[],getVehicleById:async()=>null},
  "@/lib/data/public-metadata":{getPublicListingBySlug:async()=>({configured:true,data:listing,error:null})},
  "@/lib/data/vehicle-catalogue":{getCatalogueSelection:async()=>catalogueSelection},"@/lib/data/reputation":{getPublicMemberProfileById:async()=>null},
  "@/lib/data/part-passport":{getPartPassportEvidence:async()=>null},"@/lib/listing-trust":{conditionLabel:value=>value},
  "@/lib/identifiers":{isUuid:value=>value==="11111111-1111-4111-8111-111111111111"},"@/lib/stripe-payments":{isStripeCheckoutConfigured:()=>false},
  "@/lib/marketplace-policy":{isMarketplaceUserBlocked:async()=>false},"@/lib/seller-geo":{getSellerDistanceFromPostcode:async()=>null},
  "@/lib/metadata":{buildListingJsonLd:()=>null,buildListingResultMetadata:()=>({}),serializeJsonLd:JSON.stringify}
 });
 const tree=await PartPage({params:Promise.resolve({slug:listing.slug}),searchParams:Promise.resolve({})});
 const rendered=textContent(tree);
 assert.match(rendered,/No individual vehicle fitments are recorded for this part/);
 assert.match(rendered,/Select your vehicle to see evidence-based compatibility/);
 assert.doesNotMatch(rendered,/legacy QA vehicle|compatibility confidence above/i);

 compatibility={level:"confirmed",label:"Confirmed fit",detail:"An exact catalogue fitment supports this selected vehicle.",verifiedFit:null};
 catalogueSelection={variantId:"11111111-1111-4111-8111-111111111111",year:2020,make:"Volkswagen",modelFamily:"Golf",variant:"GTI",fuelType:"petrol",engineSizeSimple:1984};
 const selectedTree=await PartPage({
  params:Promise.resolve({slug:listing.slug}),
  searchParams:Promise.resolve({cv:catalogueSelection.variantId,cy:String(catalogueSelection.year),cf:"petrol",ce:"1984"})
 });
 const selectedRendered=textContent(selectedTree);
 assert.match(selectedRendered,/No individual vehicle fitments are recorded for this part/);
 assert.match(selectedRendered,/Review the evidence above for your selected vehicle/);
 assert.doesNotMatch(selectedRendered,/Select your vehicle to see evidence-based compatibility/);
});
