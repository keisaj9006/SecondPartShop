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
const icons=new Proxy({},{get:()=>icon});

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
   if(name==="lucide-react")return icons;
   if(name in dependencies)return dependencies[name];
   throw new Error(`Unexpected dependency ${name} in ${relativePath}`);
  },
  URL,URLSearchParams,Request,Response,AbortController,console,...globals
 });
 return exports;
}

const marketplaceNavigation=moduleFrom("src/lib/marketplace-navigation.ts");
const loadVehicleContext=browserWindow=>moduleFrom("src/lib/vehicle-context.ts",{},browserWindow?{window:browserWindow}:{});

function hookRunner({router,searchParams="",pathname="/",windowOverrides={}}={}){
 const state=[];
 const refs=[];
 const effectDeps=[];
 let hookIndex=0;
 let pendingEffects=[];
 let transitionPending=false;
 const window={
  location:{pathname,search:searchParams?`?${searchParams}`:""},
  setTimeout(callback){callback();return 1;},
  clearTimeout(){},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}},
  ...windowOverrides
 };
 const react={
  useState(initial){
   const index=hookIndex++;
   if(!(index in state))state[index]=typeof initial==="function"?initial():initial;
   return [state[index],value=>{state[index]=typeof value==="function"?value(state[index]):value;}];
  },
  useRef(initial){const index=hookIndex++;if(!(index in refs))refs[index]={current:initial};return refs[index];},
  useMemo(factory){hookIndex++;return factory();},
  useTransition(){hookIndex++;return [transitionPending,callback=>callback()];},
  useEffect(effect,deps){
   const index=hookIndex++;
   const previous=effectDeps[index];
   const changed=!previous||!deps||deps.some((value,position)=>!Object.is(value,previous[position]));
   effectDeps[index]=deps;
   if(changed)pendingEffects.push(effect);
  }
 };
 return {
  react,window,
  navigation:{useRouter:()=>router,usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams(searchParams)},
  render(component,props){hookIndex=0;pendingEffects=[];return component(props);},
  async flushEffects(){
   const effects=pendingEffects;pendingEffects=[];
   for(const effect of effects)effect();
   await new Promise(resolve=>setImmediate(resolve));
  },
  setPending(value){transitionPending=value;},
  setSearchParams(value){searchParams=value;window.location.search=value?`?${value}`:"";}
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

function findNode(tree,predicate){
 const match=nodes(tree).find(predicate);
 assert.ok(match,"Expected rendered node was not found");
 return match;
}

function loadMarketplaceSearch(runner,suggestions={categories:[],listings:[],numbers:[],brands:[]}){
 const CategoryBrowser=function CategoryBrowser(){return null;};
 const api=moduleFrom("src/components/marketplace-search.tsx",{
  react:runner.react,
  "next/navigation":runner.navigation,
  "@/components/category-browser":{CategoryBrowser},
  "@/components/part-code-scanner":{PartCodeScanner:()=>null},
  "@/lib/category-tree":{getCategoryPath:()=>"Category path"},
  "@/lib/marketplace-navigation":marketplaceNavigation,
  "@/lib/vehicle-context":loadVehicleContext(runner.window)
 },{
  window:runner.window,
  document:{addEventListener(){},removeEventListener(){}},
  fetch:async()=>({json:async()=>suggestions})
 });
 return {MarketplaceSearch:api.MarketplaceSearch,CategoryBrowser};
}

const filters={
 query:"alternator",category:"cat-a",condition:"used",sort:"price_asc",minPrice:10,maxPrice:200,
 postcode:"EH25 9BE",collectionOnly:true,catalogueVariant:"11111111-1111-4111-8111-111111111111",
 catalogueYear:2020,catalogueFuel:"petrol",catalogueEngineSize:1984,compatibleOnly:true
};
const categories=[{id:"cat-a",name:"Alternators"},{id:"cat-b",name:"Gearboxes"}];

test("marketplace search submit resets page and cursor while preserving active constraints and anchor",()=>{
 const pushes=[];
 const runner=hookRunner({router:{push:(...args)=>pushes.push(args)},searchParams:"q=alternator&category=cat-a&condition=used&sort=price_asc&min=10&max=200&cv=11111111-1111-4111-8111-111111111111&cy=2020&page=4&cursor=old"});
 const {MarketplaceSearch}=loadMarketplaceSearch(runner);
 let tree=runner.render(MarketplaceSearch,{categories,filters});
 const input=findNode(tree,node=>node.type==="input"&&node.props["aria-label"]==="Search marketplace");
 input.props.onChange({target:{value:"DSG"}});
 tree=runner.render(MarketplaceSearch,{categories,filters});
 findNode(tree,node=>node.type==="form").props.onSubmit({preventDefault(){}});
 assert.equal(pushes[0][0],"/?q=DSG&category=cat-a&condition=used&sort=price_asc&min=10&max=200&cv=11111111-1111-4111-8111-111111111111&cy=2020#marketplace");
});

test("marketplace suggestion, category selection and category clearing reset both pagination keys",async()=>{
 const pushes=[];
 const runner=hookRunner({router:{push:(...args)=>pushes.push(args)},searchParams:"q=alternator&category=cat-a&min=10&page=4&cursor=old"});
 const suggestions={categories:[],listings:[{kind:"listing",label:"DSG gearbox",query:"DSG"}],numbers:[],brands:[]};
 const {MarketplaceSearch,CategoryBrowser}=loadMarketplaceSearch(runner,suggestions);
 let tree=runner.render(MarketplaceSearch,{categories,filters});
 await runner.flushEffects();
 tree=runner.render(MarketplaceSearch,{categories,filters});
 findNode(tree,node=>node.type==="button"&&textContent(node)==="DSG gearbox").props.onClick();
 assert.equal(pushes.at(-1)[0],"/?q=DSG&category=cat-a&min=10#marketplace");

 tree=runner.render(MarketplaceSearch,{categories,filters});
 findNode(tree,node=>node.type==="button"&&textContent(node).includes("Browse categories")).props.onClick();
 tree=runner.render(MarketplaceSearch,{categories,filters});
 findNode(tree,node=>node.type===CategoryBrowser).props.onSelect(categories[1]);
 assert.equal(pushes.at(-1)[0],"/?q=alternator&category=cat-b&min=10#marketplace");

 tree=runner.render(MarketplaceSearch,{categories,filters});
 findNode(tree,node=>node.type==="button"&&node.props["aria-label"]==="Remove category").props.onClick();
 assert.equal(pushes.at(-1)[0],"/?q=alternator&min=10#marketplace");
});

test("header category selection resets both pagination keys and keeps unrelated constraints",()=>{
 const pushes=[];
 const runner=hookRunner({router:{push:(...args)=>pushes.push(args)},searchParams:"q=alternator&min=10&cv=11111111-1111-4111-8111-111111111111&page=4&cursor=old"});
 const CategoryBrowser=function CategoryBrowser(){return null;};
 const {HeaderShell}=moduleFrom("src/components/header-shell.tsx",{
  react:runner.react,"next/navigation":runner.navigation,"next/link":"a",
  "@/app/auth/actions":{signOut(){}},"@/components/category-browser":{CategoryBrowser}
  ,"@/lib/marketplace-navigation":marketplaceNavigation
 },{window:runner.window,document:{addEventListener(){},removeEventListener(){}}});
 let tree=runner.render(HeaderShell,{categories,user:false,displayName:null,seller:false});
 findNode(tree,node=>node.type==="button"&&textContent(node).includes("Car parts")).props.onClick();
 tree=runner.render(HeaderShell,{categories,user:false,displayName:null,seller:false});
 findNode(tree,node=>node.type===CategoryBrowser).props.onSelect(categories[1]);
 assert.equal(pushes[0][0],"/?q=alternator&min=10&cv=11111111-1111-4111-8111-111111111111&category=cat-b#marketplace");
});

test("fit toggle canonicalizes conflicting vehicle contexts for both ON and OFF transitions",()=>{
 const pushes=[];
 const garage="11111111-1111-4111-8111-111111111111";
 const runner=hookRunner({router:{push:(...args)=>pushes.push(args)},searchParams:`q=alternator&gv=${garage}&cv=22222222-2222-4222-8222-222222222222&cy=2020&cf=petrol&ce=1984&vehicle=legacy&page=4&cursor=old`});
 const {VehicleCompatibilityToggle}=moduleFrom("src/components/vehicle-compatibility-toggle.tsx",{
  react:runner.react,"next/navigation":runner.navigation,"@/lib/marketplace-navigation":marketplaceNavigation,
  "@/lib/vehicle-context":loadVehicleContext(runner.window)
 });
 let tree=runner.render(VehicleCompatibilityToggle,{vehicleLabel:"Audi A3",checked:false});
 findNode(tree,node=>node.type==="input").props.onChange({target:{checked:true}});
 assert.equal(pushes[0][0],`/?q=alternator&gv=${garage}&fit=1#marketplace`);
 runner.setPending(false);
 runner.setSearchParams(`q=alternator&gv=${garage}&fit=1`);
 tree=runner.render(VehicleCompatibilityToggle,{vehicleLabel:"Audi A3",checked:true});
 findNode(tree,node=>node.type==="input").props.onChange({target:{checked:false}});
 assert.equal(pushes[1][0],`/?q=alternator&gv=${garage}&fit=0#marketplace`);
});

test("Garage deletion clears persisted selection only after success and only for the matching viewer and Garage ID",async()=>{
 const selected="11111111-1111-4111-8111-111111111111";
 const other="22222222-2222-4222-8222-222222222222";
 const entries=new Map([["secondpart.web.vehicle-context.v1",JSON.stringify({viewerId:"viewer-a",selection:{kind:"garage",garageVehicleId:selected,fitOnly:true}})]]);
 const storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};
 let result={ok:true};const submitted=[];
 const api=moduleFrom("src/components/garage-vehicle-remove-form.tsx",{
  react:{useState:initial=>[initial,()=>{}]},
  "@/app/garage/actions":{removeGarageVehicle:async data=>{submitted.push(data);return result;}},
  "@/lib/vehicle-context":loadVehicleContext({localStorage:storage})
 });
 const invoke=async garageVehicleId=>{
  const tree=api.GarageVehicleRemoveForm({garageVehicleId,viewerId:"viewer-a",label:"Remove vehicle"});
  const form=findNode(tree,node=>node.type==="form");
  await form.props.action({id:garageVehicleId});
 };
 await invoke(other);
 assert.equal(entries.has("secondpart.web.vehicle-context.v1"),true,"deleting a different row preserves selection");
 await invoke(selected);
 assert.equal(entries.has("secondpart.web.vehicle-context.v1"),false,"deleting the selected row clears its saved context");
 assert.equal(submitted.length,2,"both deletes remain routed through the server action");
 entries.set("secondpart.web.vehicle-context.v1",JSON.stringify({viewerId:"viewer-a",selection:{kind:"garage",garageVehicleId:selected,fitOnly:true}}));
 result={ok:false};
 await invoke(selected);
 assert.equal(entries.has("secondpart.web.vehicle-context.v1"),true,"failed deletion preserves selection");
 entries.set("secondpart.web.vehicle-context.v1",JSON.stringify({viewerId:"viewer-b",selection:{kind:"garage",garageVehicleId:selected,fitOnly:true}}));
 result={ok:true};
 await invoke(selected);
 assert.equal(entries.has("secondpart.web.vehicle-context.v1"),true,"another viewer's stored selection is never cleared");
});
test("part-code and postcode searches reset both pagination keys",async()=>{
 const scannerPushes=[];
 const scannerRunner=hookRunner({router:{push:value=>scannerPushes.push(value)},searchParams:"q=alternator&category=cat-a&min=10&page=4&cursor=old"});
 const {PartCodeScanner}=moduleFrom("src/components/part-code-scanner.tsx",{
  react:scannerRunner.react,"next/navigation":scannerRunner.navigation,"@/lib/marketplace-navigation":marketplaceNavigation
 },{window:scannerRunner.window});
 let tree=scannerRunner.render(PartCodeScanner,{});
 findNode(tree,node=>node.type==="input"&&node.props.placeholder==="Detected or printed part code").props.onChange({target:{value:"02E 301 103"}});
 tree=scannerRunner.render(PartCodeScanner,{});
 findNode(tree,node=>node.type==="button"&&textContent(node).includes("Search code")).props.onClick();
 assert.equal(scannerPushes[0],"/?q=02E+301+103&min=10#marketplace");

 const postcodePushes=[];
 const postcodeRunner=hookRunner({router:{push:value=>postcodePushes.push(value)},searchParams:"q=alternator&min=10&page=4&cursor=old"});
 const {PostcodeDistanceFilter}=moduleFrom("src/components/postcode-distance-filter.tsx",{
  react:postcodeRunner.react,"next/navigation":postcodeRunner.navigation,"@/lib/marketplace-navigation":marketplaceNavigation
 },{window:postcodeRunner.window,fetch:async()=>({ok:true,json:async()=>({ok:true,postcode:"EH25 9BE"})})});
 tree=postcodeRunner.render(PostcodeDistanceFilter,{});
 findNode(tree,node=>node.type==="input"&&node.props["aria-label"]==="Buyer postcode").props.onChange({target:{value:"eh25 9be"}});
 tree=postcodeRunner.render(PostcodeDistanceFilter,{});
 await findNode(tree,node=>node.type==="button"&&textContent(node).includes("Show distance")).props.onClick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(postcodePushes[0],"/?q=alternator&min=10&pc=EH25+9BE&sort=distance#marketplace");
});

test("search input rebases after submit, URL commit and Back while keeping drafts through unrelated rerenders",async()=>{
 const pushes=[];
 const runner=hookRunner({router:{push:value=>pushes.push(value)},searchParams:"q=A"});
 const {MarketplaceSearch}=loadMarketplaceSearch(runner);
 let tree=runner.render(MarketplaceSearch,{categories,filters:{...filters,query:"A"}});
 const input=()=>findNode(tree,node=>node.type==="input"&&node.props["aria-label"]==="Search marketplace");
 input().props.onChange({target:{value:"B"}});
 tree=runner.render(MarketplaceSearch,{categories,filters:{...filters,query:"A"}});
 findNode(tree,node=>node.type==="form").props.onSubmit({preventDefault(){}});
 assert.match(pushes.at(-1),/[?&]q=B(?:&|#)/);

 runner.setSearchParams("q=B");
 tree=runner.render(MarketplaceSearch,{categories,filters:{...filters,query:"B"}});
 tree=runner.render(MarketplaceSearch,{categories,filters:{...filters,query:"B"}});
 assert.equal(input().props.value,"B");

 runner.setSearchParams("q=A");
 tree=runner.render(MarketplaceSearch,{categories,filters:{...filters,query:"A"}});
 tree=runner.render(MarketplaceSearch,{categories,filters:{...filters,query:"A"}});
 assert.equal(input().props.value,"A");

 runner.setSearchParams("q=B");
 tree=runner.render(MarketplaceSearch,{categories,filters:{...filters,query:"B"}});
 tree=runner.render(MarketplaceSearch,{categories,filters:{...filters,query:"B"}});
 input().props.onChange({target:{value:"unsubmitted draft"}});
 tree=runner.render(MarketplaceSearch,{categories,filters:{...filters,query:"B"},activeVehicleLabel:"Audi A3"});
 tree=runner.render(MarketplaceSearch,{categories,filters:{...filters,query:"B"},activeVehicleLabel:"Audi A3"});
 assert.equal(input().props.value,"unsubmitted draft");
});

test("both vehicle removal entry points clear persistent context and URL vehicle pagination keys",()=>{
 const removed=[];const pushes=[];
 const storage={getItem(){return null;},setItem(){},removeItem:key=>removed.push(key)};
 const runner=hookRunner({router:{push:value=>pushes.push(value)},searchParams:"q=alternator&cv=11111111-1111-4111-8111-111111111111&cy=2020&cf=petrol&ce=1984&fit=1&page=4&cursor=old",windowOverrides:{localStorage:storage}});
 const {MarketplaceSearch}=loadMarketplaceSearch(runner);
 let tree=runner.render(MarketplaceSearch,{categories,filters,activeVehicleLabel:"Audi A3"});
 findNode(tree,node=>node.type==="button"&&node.props["aria-label"]==="Remove vehicle").props.onClick();
 assert.deepEqual(removed,["secondpart.web.vehicle-context.v1"]);
 assert.equal(pushes.at(-1),"/?q=alternator#marketplace");

 const selectorRunner=hookRunner({router:{push:value=>pushes.push(value)},windowOverrides:{localStorage:storage}});
 const {VehicleSelector}=moduleFrom("src/components/vehicle-selector.tsx",{
  react:selectorRunner.react,"next/navigation":selectorRunner.navigation,
  "@/components/vehicle-visual":{VehicleVisual:()=>null},
  "@/lib/vehicle-context":loadVehicleContext(selectorRunner.window)
 },{window:selectorRunner.window,fetch:async()=>({ok:true,json:async()=>({items:[]})})});
 const vehicle={id:"legacy",make:"Audi",model:"A3",year:2020};
 tree=selectorRunner.render(VehicleSelector,{vehicles:[vehicle],selectedId:"legacy",selectedCatalogue:null,baseParams:{q:"alternator"},compatibleOnly:true});
 findNode(tree,node=>node.type==="button"&&textContent(node).includes("Remove vehicle")).props.onClick();
 assert.deepEqual(removed,["secondpart.web.vehicle-context.v1","secondpart.web.vehicle-context.v1"]);
 assert.equal(pushes.at(-1),"/?q=alternator#marketplace");
});

test("vehicle removal still navigates when storage access or removal throws",()=>{
 const chipPushes=[];
 const chipRunner=hookRunner({router:{push:value=>chipPushes.push(value)},searchParams:"q=alternator&cv=11111111-1111-4111-8111-111111111111&cy=2020"});
 Object.defineProperty(chipRunner.window,"localStorage",{configurable:true,get(){throw new DOMException("Blocked","SecurityError");}});
 const {MarketplaceSearch}=loadMarketplaceSearch(chipRunner);
 let tree=chipRunner.render(MarketplaceSearch,{categories,filters,activeVehicleLabel:"Audi A3"});
 assert.doesNotThrow(()=>findNode(tree,node=>node.type==="button"&&node.props["aria-label"]==="Remove vehicle").props.onClick());
 assert.equal(chipPushes[0],"/?q=alternator#marketplace");

 const selectorPushes=[];
 const selectorRunner=hookRunner({router:{push:value=>selectorPushes.push(value)},windowOverrides:{localStorage:{removeItem(){throw new DOMException("Blocked","SecurityError");}}}});
 const {VehicleSelector}=moduleFrom("src/components/vehicle-selector.tsx",{
  react:selectorRunner.react,"next/navigation":selectorRunner.navigation,
  "@/components/vehicle-visual":{VehicleVisual:()=>null},"@/lib/vehicle-context":loadVehicleContext(selectorRunner.window)
 },{window:selectorRunner.window,fetch:async()=>({ok:true,json:async()=>({items:[]})})});
 const vehicle={id:"legacy",make:"Audi",model:"A3",year:2020};
 tree=selectorRunner.render(VehicleSelector,{vehicles:[vehicle],selectedId:"legacy",selectedCatalogue:null,baseParams:{q:"alternator"},compatibleOnly:true});
 assert.doesNotThrow(()=>findNode(tree,node=>node.type==="button"&&textContent(node).includes("Remove vehicle")).props.onClick());
 assert.equal(selectorPushes[0],"/?q=alternator#marketplace");
});

test("clear then reload does not restore vehicle context and addVehicle mode never prefills Garage selection",async()=>{
 const replacements=[];
 const entries=new Map([["secondpart.web.vehicle-context.v1",JSON.stringify({cv:"11111111-1111-4111-8111-111111111111",cy:"2020"})]]);
 const storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};
 storage.removeItem("secondpart.web.vehicle-context.v1");
 for(const searchParams of ["q=alternator","addVehicle=1"]){
  const runner=hookRunner({router:{replace:value=>replacements.push(value)},searchParams,windowOverrides:{localStorage:storage}});
  const {VehicleContextPersistence}=moduleFrom("src/components/vehicle-context-persistence.tsx",{
   react:runner.react,"next/navigation":runner.navigation,
   "@/lib/vehicle-context":loadVehicleContext(runner.window)
  },{window:runner.window});
  runner.render(VehicleContextPersistence,{viewerId:"viewer-a",garageContextValid:true});
  await runner.flushEffects();
 }
 assert.deepEqual(replacements,[]);
});

test("vehicle persistence stores only a viewer-scoped Garage ID and rejects a previous viewer's context",async()=>{
 const GARAGE="11111111-1111-4111-8111-111111111111";
 const entries=new Map();
 const storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};
 const writer=hookRunner({router:{replace(){}},searchParams:`gv=${GARAGE}&fit=1`,windowOverrides:{localStorage:storage}});
 const {VehicleContextPersistence}=moduleFrom("src/components/vehicle-context-persistence.tsx",{
  react:writer.react,"next/navigation":writer.navigation,"@/lib/vehicle-context":loadVehicleContext(writer.window)
 },{window:writer.window});
 writer.render(VehicleContextPersistence,{viewerId:"viewer-a",garageContextValid:true});
 await writer.flushEffects();
 assert.deepEqual(JSON.parse(entries.get("secondpart.web.vehicle-context.v1")),{viewerId:"viewer-a",selection:{kind:"garage",garageVehicleId:GARAGE,fitOnly:true}});

 const replacements=[];
 const reader=hookRunner({router:{replace:value=>replacements.push(value)},searchParams:"q=brake",windowOverrides:{localStorage:storage}});
 const readerModule=moduleFrom("src/components/vehicle-context-persistence.tsx",{
  react:reader.react,"next/navigation":reader.navigation,"@/lib/vehicle-context":loadVehicleContext(reader.window)
 },{window:reader.window});
 reader.render(readerModule.VehicleContextPersistence,{viewerId:"viewer-b",garageContextValid:true});
 await reader.flushEffects();
 assert.equal(entries.has("secondpart.web.vehicle-context.v1"),false);
 assert.deepEqual(replacements,[]);
});

test("same-viewer Garage state restores through canonical gv; add mode suppresses it without erasing the saved selection",async()=>{
 const GARAGE="11111111-1111-4111-8111-111111111111";
 const entries=new Map([["secondpart.web.vehicle-context.v1",JSON.stringify({viewerId:"viewer-a",selection:{kind:"garage",garageVehicleId:GARAGE,fitOnly:false}})]]);
 const storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};
 const replacements=[];
 const runner=hookRunner({router:{replace:value=>replacements.push(value)},searchParams:"q=brake",windowOverrides:{localStorage:storage}});
 const api=moduleFrom("src/components/vehicle-context-persistence.tsx",{
  react:runner.react,"next/navigation":runner.navigation,"@/lib/vehicle-context":loadVehicleContext(runner.window)
 },{window:runner.window});
 runner.render(api.VehicleContextPersistence,{viewerId:"viewer-a",garageContextValid:true});
 await runner.flushEffects();
 assert.equal(replacements[0],`/?q=brake&gv=${GARAGE}&fit=0#marketplace`);

 const addMode=hookRunner({router:{replace:value=>replacements.push(value)},searchParams:"addVehicle=1",windowOverrides:{localStorage:storage}});
 const addApi=moduleFrom("src/components/vehicle-context-persistence.tsx",{
  react:addMode.react,"next/navigation":addMode.navigation,"@/lib/vehicle-context":loadVehicleContext(addMode.window)
 },{window:addMode.window});
 addMode.render(addApi.VehicleContextPersistence,{viewerId:"viewer-a",garageContextValid:true});
 await addMode.flushEffects();
 assert.equal(replacements.length,1);
 assert.equal(entries.has("secondpart.web.vehicle-context.v1"),true);
});

test("Home Garage links select an identity-only Garage row without converting it to catalogue context",()=>{
 const ProductCard=function ProductCard(){return null;};
 const dependencies={
  "next/link":"a","@/app/garage/actions":{saveGarageVehicleForm(){}},
  "./product-card":{ProductCard},"./vehicle-selector":{VehicleSelector:()=>null},"./vehicle-visual":{VehicleVisual:()=>null},
  "./marketplace-filters":{MarketplaceFiltersPanel:()=>null},"./marketplace-search":{MarketplaceSearch:()=>null},"./part-request-card":{PartRequestCard:()=>null},
  "./postcode-distance-filter":{PostcodeDistanceFilter:()=>null},"./offer-group-card":{OfferGroupCard:()=>null},"@/lib/offer-groups":{groupListingsForOffers:()=>[]},
  "./save-search-control":{SaveSearchControl:()=>null},"./vehicle-compatibility-toggle":{VehicleCompatibilityToggle:()=>null},"./vehicle-context-persistence":{VehicleContextPersistence:()=>null},"@/lib/vehicle-context":loadVehicleContext()
 };
 const api=moduleFrom("src/components/marketplace-home.tsx",dependencies);
 const garage={id:"11111111-1111-4111-8111-111111111111",catalogueVariantId:null,year:2018,fuelType:null,engineSizeSimple:null,registration:"AB12CDE",colour:"grey",nickname:null,make:"Ford",model:"Transit",modelFamily:"Transit",variant:null,createdAt:"2026-01-01"};
 const tree=api.MarketplaceHome({listings:[],categories:[],vehicles:[],garageVehicles:[garage],recentlyViewed:[],signedIn:true,viewerId:"viewer-a",filters:{...filters,query:"alternator"},selectedCatalogue:null,savedIds:[],error:null,configured:true,pagination:{offset:0,limit:24,returned:0,total:0,hasMore:false,mode:"offset",nextCursor:null},currentPage:1,activeGarageVehicleId:garage.id});
 const link=findNode(tree,node=>String(node.props?.href).includes("gv="));
 assert.equal(link.props.href,`/?q=alternator&category=cat-a&condition=used&sort=price_asc&min=10&max=200&pc=EH25+9BE&collection=1&gv=${garage.id}&fit=1#marketplace`);
 assert.equal(link.props.href.includes("cv="),false);
 const search=findNode(tree,node=>node.props?.filters&&node.props?.activeVehicleLabel!==undefined);
 assert.equal(search.props.activeVehicleLabel,"AB12CDE · Ford Transit 2018");
});

test("marketplace cards retain page and cursor context and selector identity includes fuel and engine",()=>{
 const ProductCard=function ProductCard(){return null;};
 const dependencies={
  "next/link":"a","@/app/garage/actions":{saveGarageVehicle(){}},
  "@/components/product-card":{ProductCard},"./product-card":{ProductCard},
  "./vehicle-selector":{VehicleSelector:function VehicleSelector(){return null;}},
  "./vehicle-visual":{VehicleVisual:()=>null},"./marketplace-filters":{MarketplaceFiltersPanel:()=>null},
  "./marketplace-search":{MarketplaceSearch:()=>null},"./part-request-card":{PartRequestCard:()=>null},
  "./postcode-distance-filter":{PostcodeDistanceFilter:()=>null},"./offer-group-card":{OfferGroupCard:()=>null},
  "@/lib/offer-groups":{groupListingsForOffers:listings=>listings.map(item=>({key:item.id,listings:[item]}))},
  "./save-search-control":{SaveSearchControl:()=>null},"./vehicle-compatibility-toggle":{VehicleCompatibilityToggle:()=>null},
  "./vehicle-context-persistence":{VehicleContextPersistence:()=>null},
  "@/lib/vehicle-context":loadVehicleContext()
 };
 const {MarketplaceHome}=moduleFrom("src/components/marketplace-home.tsx",dependencies);
 const listing={id:"part-1"};
 const common={listings:[listing],categories:[],vehicles:[],garageVehicles:[],recentlyViewed:[],signedIn:false,filters:{...filters,query:"alternator"},savedIds:[],error:null,configured:true,pagination:{offset:72,limit:24,returned:1,total:null,hasMore:true,mode:"cursor",nextCursor:"next"},currentPage:4,currentCursor:"current-cursor"};
 let tree=MarketplaceHome({...common,selectedCatalogue:{variantId:"variant",year:2020,make:"Audi",modelFamily:"A3",variant:"Sport",fuelType:"petrol",engineSizeSimple:1984}});
 assert.match(findNode(tree,node=>node.type===ProductCard).props.contextQuery,/(^|&)page=4(&|$)/);
 assert.match(findNode(tree,node=>node.type===ProductCard).props.contextQuery,/(^|&)cursor=current-cursor(&|$)/);
 const selectorKeyA=findNode(tree,node=>node.type.name==="VehicleSelector").key;
 tree=MarketplaceHome({...common,selectedCatalogue:{variantId:"variant",year:2020,make:"Audi",modelFamily:"A3",variant:"Sport",fuelType:"diesel",engineSizeSimple:1968}});
 const selectorKeyB=findNode(tree,node=>node.type.name==="VehicleSelector").key;
 assert.notEqual(selectorKeyA,selectorKeyB);
});

test("product Back to results includes the incoming cursor",async()=>{
 const listing={
  id:"part-1",slug:"part-one",sellerId:"seller-1",seller:{ownerId:null,slug:"seller",businessName:"Seller",location:"Leeds",verified:false,sellerType:"business"},
  images:[],condition:"used",stock:1,title:"Part one",pricePence:1000,shippingPence:0,collectionAvailable:false,
  deliveryDaysMin:null,deliveryDaysMax:null,description:"Description",category:{isTransmissionRelated:false},fitments:[],oemNumber:null
 };
 const Link="a";
 const {default:PartPage}=moduleFrom("src/app/parts/[slug]/page.tsx",{
  "next/navigation":{notFound(){}},"next/link":Link,
  "@/components/ask-seller-form":{AskSellerForm:()=>null},"@/components/buy-now-form":{BuyNowForm:()=>null},
  "@/components/compatibility-badge":{CompatibilityBadge:()=>null},"@/components/header":{Header:()=>null},
  "@/components/marketplace-user-block-button":{MarketplaceUserBlockButton:()=>null},"@/components/product-gallery":{ProductGallery:()=>null},
  "@/components/part-passport":{PartPassport:()=>null},"@/components/save-button":{SaveButton:()=>null},
  "@/components/recently-viewed-tracker":{RecentlyViewedTracker:()=>null},"@/lib/auth":{getCurrentUser:async()=>null},
  "@/lib/data/compatibility":{getPartCompatibility:async()=>null},"@/lib/data/checkout":{isSellerCheckoutReady:async()=>false},
  "@/lib/data/marketplace":{getSavedPartIdsForParts:async()=>[],getVehicleById:async()=>null},
  "@/lib/data/public-metadata":{getPublicListingBySlug:async()=>({data:listing,configured:true,error:null})},
  "@/lib/data/vehicle-catalogue":{getCatalogueSelection:async()=>null},"@/lib/data/reputation":{getPublicMemberProfileById:async()=>null},
  "@/lib/data/part-passport":{getPartPassportEvidence:async()=>null},"@/lib/listing-trust":{conditionLabel:()=>"Used"},
  "@/lib/identifiers":{isUuid:()=>false},"@/lib/stripe-payments":{isStripeCheckoutConfigured:()=>false},
  "@/lib/marketplace-policy":{isMarketplaceUserBlocked:async()=>false},"@/lib/seller-geo":{getSellerDistanceFromPostcode:async()=>null},
  "@/lib/metadata":{buildListingJsonLd:()=>null,buildListingResultMetadata:()=>({}),serializeJsonLd:JSON.stringify}
 });
 const tree=await PartPage({params:Promise.resolve({slug:"part-one"}),searchParams:Promise.resolve({q:"alternator",page:"4",cursor:"current-cursor"})});
 const back=findNode(tree,node=>typeof node.props?.href==="string"&&node.props.href.startsWith("/?"));
 assert.equal(back.props.href,"/?q=alternator&page=4&cursor=current-cursor#marketplace");
});
