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

function moduleFrom(relativePath,dependencies={},globals={}){
 const source=fs.readFileSync(path.join(root,relativePath),"utf8");
 const output=ts.transpileModule(source,{
  compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
 }).outputText;
 const exports={};
 vm.runInNewContext(output,{
  exports,
  require(name){
   if(name==="react/jsx-runtime")return jsxRuntime;
   if(name in dependencies)return dependencies[name];
   throw new Error(`Unexpected dependency ${name} in ${relativePath}`);
  },
  process:{env:{}},URL,URLSearchParams,console,...globals
 });
 return exports;
}

const metadata=moduleFrom("src/lib/metadata.ts");

const seller={
 id:"seller-1",ownerId:"owner-1",businessName:"Northern Recyclers",slug:"northern-recyclers",
 location:"Leeds",postcode:"LS1 1AA",description:"A <b>long-standing</b> vehicle recycler.",
 verified:true,sellerType:"business",businessKind:"breaker"
};
const listing={
 id:"part-1",sellerId:seller.id,categoryId:"cat-1",donorVehicleId:null,sourceChannel:"manual",sourceExternalId:null,
 importBatchId:null,slug:"ford-focus-alternator",title:"Ford Focus Alternator",description:"Tested used alternator <script>alert('x')</script> for selected Focus models.",
 manufacturer:null,partNumber:null,oemNumber:null,gearboxFamily:null,gearboxCode:null,condition:"used",pricePence:12345,
 shippingPence:995,stock:2,status:"active",dispatchDays:2,testingStatus:"tested_working",warrantyDays:30,
 conditionNotes:null,damageNotes:null,collectionAvailable:true,deliveryDaysMin:2,deliveryDaysMax:4,
 category:{id:"cat-1",parentId:null,name:"Alternators",slug:"alternators",isTransmissionRelated:false,isSelectable:true,sortOrder:1,searchTerms:[]},
 seller,images:[{id:"image-1",url:"https://cdn.example.com/part.jpg",alt:"Alternator",position:0}],fitments:[]
};

test("root metadata noindexes preview and development even when a plausible site URL is configured",()=>{
 for(const vercelEnv of ["preview","development",undefined]){
  const value=metadata.buildRootMetadata({vercelEnv,siteUrl:"https://secondpart.co.uk"});
  assert.equal(value.robots.index,false);
  assert.equal(value.robots.follow,false);
  assert.equal(value.alternates,undefined);
  assert.equal(value.openGraph,undefined);
 }
});

test("production metadata fails closed when the canonical origin is missing or unsafe",()=>{
 const unsafe=[undefined,"","http://secondpart.co.uk","https://user:pass@secondpart.co.uk","https://secondpart.co.uk/shop","https://secondpart.co.uk/?x=1","https://localhost","https://preview.secondpart.co.uk","https://secondpart.vercel.app"];
 for(const siteUrl of unsafe){
  const value=metadata.buildHomeMetadata({vercelEnv:"production",siteUrl});
  assert.equal(value.alternates,undefined,siteUrl);
  assert.equal(value.openGraph.url,undefined,siteUrl);
 }
});

test("production canonical origins require a DNS hostname rather than an IP literal",()=>{
 for(const siteUrl of [
  "https://169.254.169.254",
  "https://100.64.0.1",
  "https://198.18.0.1",
  "https://203.0.113.1",
  "https://[2001:db8::1]"
 ]){
  const value=metadata.buildHomeMetadata({vercelEnv:"production",siteUrl});
  assert.equal(value.alternates,undefined,siteUrl);
  assert.equal(value.openGraph.url,undefined,siteUrl);
 }
 assert.equal(metadata.buildHomeMetadata({vercelEnv:"production",siteUrl:"https://www.secondpart.co.uk"}).alternates.canonical,"https://www.secondpart.co.uk/");
});

test("approved production origin builds absolute canonical and Open Graph route URLs",()=>{
 const env={vercelEnv:"production",siteUrl:"https://www.secondpart.co.uk/"};
 const homeMetadata=metadata.buildHomeMetadata(env);
 assert.equal(homeMetadata.alternates.canonical,"https://www.secondpart.co.uk/");
 assert.equal(homeMetadata.openGraph.url,"https://www.secondpart.co.uk/");
 const partMetadata=metadata.buildListingMetadata(listing,env);
 assert.equal(partMetadata.alternates.canonical,"https://www.secondpart.co.uk/parts/ford-focus-alternator");
 assert.equal(partMetadata.openGraph.url,"https://www.secondpart.co.uk/parts/ford-focus-alternator");
 const sellerMetadata=metadata.buildSellerMetadata(seller,env);
 assert.equal(sellerMetadata.alternates.canonical,"https://www.secondpart.co.uk/seller/northern-recyclers");
});

test("root layout cannot leak the Home canonical or Open Graph URL into other routes",()=>{
 const rootMetadata=metadata.buildRootMetadata({vercelEnv:"production",siteUrl:"https://secondpart.co.uk"});
 assert.equal(rootMetadata.alternates,undefined);
 assert.equal(rootMetadata.openGraph,undefined);
 const privateMetadata=metadata.buildPrivateMetadata("Account","Manage your SecondPart account.");
 assert.equal(privateMetadata.alternates,undefined);
 assert.equal(privateMetadata.openGraph,undefined);
});

test("Home route exports the route-specific canonical and Open Graph metadata",()=>{
 const dependencies={
  "next/server":{after(){}},"@/components/header":{Header:()=>null},"@/components/marketplace-home":{MarketplaceHome:()=>null},
  "@/lib/data/marketplace":{getCategories(){},getMarketplacePage(){},getSavedPartIdsForParts(){},getVehicleById(){}},
  "@/lib/data/garage":{getGarageVehicleMatch(){},getGarageVehiclesPage(){}},"@/lib/data/buyer-account":{getRecentlyViewedListings(){}},
  "@/lib/data/vehicle-catalogue":{getCatalogueSelection(){}},"@/lib/auth":{getCurrentUser(){}},
  "@/lib/vehicle-registration":{normalizeRegistration:value=>value},"@/lib/postcode":{normalizePostcode:value=>value},
  "@/lib/identifiers":{isUuid:()=>false},"@/lib/analytics/search":{recordMarketplaceSearch(){}},
  "@/lib/metadata":{buildHomeMetadata:()=>metadata.buildHomeMetadata({vercelEnv:"production",siteUrl:"https://secondpart.co.uk"})}
 };
 const home=moduleFrom("src/app/page.tsx",dependencies);
 assert.equal(home.metadata.alternates.canonical,"https://secondpart.co.uk/");
 assert.equal(home.metadata.openGraph.url,"https://secondpart.co.uk/");
});

test("private metadata uses generic copy and always prevents indexing",()=>{
 const value=metadata.buildPrivateMetadata("Purchases","Track orders and delivery progress in your SecondPart account.");
 assert.equal(value.title,"Purchases | SecondPart");
 assert.equal(value.robots.index,false);
 assert.equal(value.robots.follow,false);
 assert.doesNotMatch(JSON.stringify(value),/registration|email|Northern Recyclers/i);
});

test("private route layouts publish generic noindex metadata",()=>{
 const expected=new Map([
  ["src/app/account/layout.tsx","Account | SecondPart"],
  ["src/app/account/orders/layout.tsx","Purchases | SecondPart"],
  ["src/app/garage/layout.tsx","Garage | SecondPart"],
  ["src/app/inbox/layout.tsx","Inbox | SecondPart"],
  ["src/app/saved/layout.tsx","Saved parts | SecondPart"],
  ["src/app/dashboard/layout.tsx","Seller dashboard | SecondPart"],
  ["src/app/recently-viewed/layout.tsx","Recently viewed | SecondPart"],
  ["src/app/saved-searches/layout.tsx","Saved searches | SecondPart"],
  ["src/app/notifications/layout.tsx","Notifications | SecondPart"],
  ["src/app/requests/layout.tsx","Part requests | SecondPart"],
  ["src/app/report/layout.tsx","Report listing | SecondPart"],
  ["src/app/report-user/layout.tsx","Report user | SecondPart"],
  ["src/app/beta-feedback/layout.tsx","Beta feedback | SecondPart"],
  ["src/app/garage-partner/requests/layout.tsx","Garage partner requests | SecondPart"],
  ["src/app/messages/layout.tsx","Order messages | SecondPart"],
  ["src/app/fitting/layout.tsx","Fitting request | SecondPart"]
 ]);
 for(const [file,title] of expected){
  const route=moduleFrom(file,{"@/lib/metadata":metadata,"react/jsx-runtime":jsxRuntime});
  assert.equal(route.metadata.title,title);
  assert.equal(route.metadata.robots.index,false);
  assert.equal(route.metadata.robots.follow,false);
 }
});

test("missing and failed product results return safe noindex metadata without backend details",()=>{
 for(const result of [
  {data:null,error:null,configured:true},
  {data:null,error:"database password secret",configured:true},
  {data:null,error:"Connect Supabase to load this listing.",configured:false}
 ]){
  const value=metadata.buildListingResultMetadata(result,{vercelEnv:"production",siteUrl:"https://secondpart.co.uk"});
  assert.equal(value.title,"Part unavailable | SecondPart");
  assert.equal(value.robots.index,false);
  assert.doesNotMatch(JSON.stringify(value),/database password|Supabase/i);
 }
});

test("product structured data preserves exact GBP price, condition and stock availability",()=>{
 const value=metadata.buildListingJsonLd(listing,{vercelEnv:"production",siteUrl:"https://secondpart.co.uk"});
 const product=value["@graph"][0];
 assert.equal(product["@type"],"Product");
 assert.equal(product.offers.price,"123.45");
 assert.equal(product.offers.priceCurrency,"GBP");
 assert.equal(product.offers.itemCondition,"https://schema.org/UsedCondition");
 assert.equal(product.offers.availability,"https://schema.org/InStock");
 assert.equal(product.url,"https://secondpart.co.uk/parts/ford-focus-alternator");
 const unavailable=metadata.buildListingJsonLd({...listing,condition:"reconditioned",stock:0},{vercelEnv:"production",siteUrl:"https://secondpart.co.uk"})["@graph"][0];
 assert.equal(unavailable.offers.price,"123.45");
 assert.equal(unavailable.offers.itemCondition,"https://schema.org/RefurbishedCondition");
 assert.equal(unavailable.offers.availability,"https://schema.org/OutOfStock");
});

test("structured data omits URL-dependent, image and unsupported claims when evidence is absent",()=>{
 const value=metadata.buildListingJsonLd({...listing,images:[{...listing.images[0],url:"/relative.jpg"}]},{vercelEnv:"preview",siteUrl:"https://secondpart.co.uk"});
 assert.equal(value["@type"],"Product");
 assert.equal(value.url,undefined);
 assert.equal(value["@id"],undefined);
 assert.equal(value.image,undefined);
 assert.equal(value.offers.url,undefined);
 assert.equal(value.aggregateRating,undefined);
 assert.equal(value.review,undefined);
 assert.equal(value.brand,undefined);
 assert.equal(value.isAccessoryOrSparePartFor,undefined);
});

test("JSON-LD serialization escapes less-than characters to prevent script breakout",()=>{
 const serialized=metadata.serializeJsonLd({description:"unsafe </script><script>alert('x')</script>"});
 assert.doesNotMatch(serialized,/<\/script|</i);
 assert.match(serialized,/\\u003c\/script>/);
});

test("public route loaders are wrapped in React request cache",async()=>{
 let listingCalls=0;
 const requestCache=fn=>{
  const values=new Map();
  return async key=>{
   if(!values.has(key))values.set(key,fn(key));
   return values.get(key);
  };
 };
 const loaders=moduleFrom("src/lib/data/public-metadata.ts",{
  react:{cache:requestCache},
  "@/lib/data/marketplace":{
   getListingBySlug:async slug=>{listingCalls++;return {data:{slug},error:null,configured:true};},
   getSellerBySlug:async slug=>({slug})
  }
 });
 const first=await loaders.getPublicListingBySlug("ford-focus-alternator");
 const second=await loaders.getPublicListingBySlug("ford-focus-alternator");
 assert.equal(listingCalls,1);
 assert.equal(first,second);
});

test("product metadata and page share the same cached route loader",async()=>{
 let listingCalls=0;
 let cached;
 const getPublicListingBySlug=async slug=>{
  if(!cached){listingCalls++;cached=Promise.resolve({data:{...listing,slug},error:null,configured:true});}
  return cached;
 };
 const component=()=>null;
 const icons=new Proxy({},{get:()=>component});
 const page=moduleFrom("src/app/parts/[slug]/page.tsx",{
  "next/navigation":{notFound(){throw new Error("not found");}},"next/link":component,"lucide-react":icons,
  "@/components/ask-seller-form":{AskSellerForm:component},"@/components/buy-now-form":{BuyNowForm:component},
  "@/components/compatibility-badge":{CompatibilityBadge:component},"@/components/header":{Header:component},
  "@/components/marketplace-user-block-button":{MarketplaceUserBlockButton:component},"@/components/product-gallery":{ProductGallery:component},
  "@/components/part-passport":{PartPassport:component},"@/components/save-button":{SaveButton:component},
  "@/components/recently-viewed-tracker":{RecentlyViewedTracker:component},"@/lib/auth":{getCurrentUser:async()=>null},
  "@/lib/data/compatibility":{getPartCompatibility:async()=>null},"@/lib/data/checkout":{isSellerCheckoutReady:async()=>false},
  "@/lib/data/marketplace":{getSavedPartIdsForParts:async()=>[],getVehicleById:async()=>null},
  "@/lib/data/public-metadata":{getPublicListingBySlug},"@/lib/data/vehicle-catalogue":{getCatalogueSelection:async()=>null},
  "@/lib/data/reputation":{getPublicMemberProfileById:async()=>null},"@/lib/data/part-passport":{getPartPassportEvidence:async()=>null},
  "@/lib/metadata":metadata,"@/lib/listing-trust":{conditionLabel:value=>value},"@/lib/identifiers":{isUuid:()=>false},
  "@/lib/stripe-payments":{isStripeCheckoutConfigured:()=>false},"@/lib/marketplace-policy":{isMarketplaceUserBlocked:async()=>false},
  "@/lib/seller-geo":{getSellerDistanceFromPostcode:async()=>null}
 });
 const props={params:Promise.resolve({slug:listing.slug}),searchParams:Promise.resolve({})};
 await page.generateMetadata({params:props.params});
 const tree=await page.default(props);
 assert.equal(listingCalls,1);
 const scripts=[];
 const visit=node=>{if(!node||typeof node!=="object")return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.type==="script")scripts.push(node);visit(node.props?.children);};
 visit(tree);
 assert.equal(scripts.length,1);
 assert.doesNotMatch(scripts[0].props.dangerouslySetInnerHTML.__html,/</);
});

test("seller route metadata uses the cached public seller and bounded public copy",async()=>{
 const component=()=>null;
 const icons=new Proxy({},{get:()=>component});
 const page=moduleFrom("src/app/seller/[slug]/page.tsx",{
  "next/link":component,"next/navigation":{notFound(){throw new Error("not found");}},"lucide-react":icons,
  "@/components/header":{Header:component},"@/components/product-card":{ProductCard:component},
  "@/components/reputation-summary":{ReputationSummary:component},"@/components/review-list":{ReviewList:component},
  "@/lib/data/marketplace":{getPublicSellerInventorySummary:async()=>({}),getPublicSellerListingsPage:async()=>({data:[],hasMore:false})},
  "@/lib/data/public-metadata":{getPublicSellerBySlug:async()=>({...seller,description:"<script>sensitive-script-copy</script><strong>"+"recycled parts ".repeat(100)+"</strong>"})},
  "@/lib/data/reputation":{getPublicMemberProfileById:async()=>null,getPublicMemberReviews:async()=>[]},
  "@/lib/metadata":metadata,"@/lib/seller-business":{sellerBusinessKindLabel:()=>"Vehicle recycler"}
 });
 const value=await page.generateMetadata({params:Promise.resolve({slug:seller.slug})});
 assert.equal(value.title,"Northern Recyclers | SecondPart");
 assert.ok(value.description.length<=160);
 assert.doesNotMatch(value.description,/<strong>/);
 assert.doesNotMatch(value.description,/sensitive-script-copy/);
});
