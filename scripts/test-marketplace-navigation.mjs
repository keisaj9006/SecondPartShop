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

test("fit toggle resets both pagination keys and renders checkbox, icon and copy from one visual state",()=>{
 const pushes=[];
 const runner=hookRunner({router:{push:(...args)=>pushes.push(args)},searchParams:"q=alternator&cv=11111111-1111-4111-8111-111111111111&cy=2020&page=4&cursor=old"});
 const {VehicleCompatibilityToggle}=moduleFrom("src/components/vehicle-compatibility-toggle.tsx",{
  react:runner.react,"next/navigation":runner.navigation,"@/lib/marketplace-navigation":marketplaceNavigation
 });
 let tree=runner.render(VehicleCompatibilityToggle,{vehicleLabel:"Audi A3",checked:false});
 findNode(tree,node=>node.type==="input").props.onChange({target:{checked:true}});
 assert.equal(pushes[0][0],"/?q=alternator&cv=11111111-1111-4111-8111-111111111111&cy=2020&fit=1#marketplace");

 runner.setPending(false);
 tree=runner.render(VehicleCompatibilityToggle,{vehicleLabel:"Audi A3",checked:false});
 assert.equal(findNode(tree,node=>node.type==="input").props.checked,false);
 assert.match(textContent(tree),/Showing the full marketplace/);
 assert.doesNotMatch(textContent(tree),/Only confirmed or same-family matches/);
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
   "@/lib/vehicle-context":{VEHICLE_CONTEXT_STORAGE_KEY:"secondpart.web.vehicle-context.v1",VEHICLE_CONTEXT_PARAMS:["cv","cy","cf","ce","vr","vc","fit"]}
  },{window:runner.window});
  runner.render(VehicleContextPersistence,{});
  await runner.flushEffects();
 }
 assert.deepEqual(replacements,[]);
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
  "./vehicle-context-persistence":{VehicleContextPersistence:()=>null}
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
