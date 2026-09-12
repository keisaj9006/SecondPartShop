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
const component=()=>null;
const icons=new Proxy({},{get:()=>component});

function moduleFrom(relativePath,dependencies={}){
 const source=fs.readFileSync(path.join(root,relativePath),"utf8");
 const output=ts.transpileModule(source,{
  compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
 }).outputText;
 const exports={};
 vm.runInNewContext(output,{
  exports,
  require(name){
   if(name==="react/jsx-runtime")return jsxRuntime;
   if(name==="next/link")return "a";
   if(name==="lucide-react")return icons;
   if(name in dependencies)return dependencies[name];
   throw new Error(`Unexpected dependency ${name} in ${relativePath}`);
  },
  URL,URLSearchParams,console
 });
 return exports;
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

const listing=id=>({id,slug:id});
const accountCounts={orders:0,garage:0,savedParts:0,savedSearches:0,recentlyViewed:0,openRequests:0,unreadNotifications:0};

test("product cards key their local saved control to the server viewer identity",()=>{
 const SaveButton=function SaveButton(){return null;};
 const {ProductCard}=moduleFrom("src/components/product-card.tsx",{
  "next/image":component,
  "@/components/compatibility-badge":{CompatibilityBadge:component},
  "@/lib/listing-trust":{conditionLabel:value=>value,testingStatusLabel:value=>value,warrantyLabel:value=>value},
  "./compatibility-badge":{CompatibilityBadge:component},
  "./product-image":{ProductImage:component},
  "./save-button":{SaveButton}
 });
 const item={
  id:"part-1",slug:"part-1",title:"Part one",images:[],condition:"used",testingStatus:"not_specified",warrantyDays:0,
  compatibility:null,oemNumber:null,partNumber:null,seller:{verified:false,location:"Leeds"},pricePence:1000,stock:1,
  collectionAvailable:false,deliveryDaysMin:null,deliveryDaysMax:null
 };

 const tree=ProductCard({item,viewerId:"viewer-1"});
 const saveButton=nodes(tree).find(node=>node.type===SaveButton);
 assert.equal(saveButton.key,"viewer-1");
 assert.equal(saveButton.props.viewerId,"viewer-1");
});

test("account recent cards resolve saved state for only the current viewer and visible parts",async()=>{
 const ProductCard=function ProductCard(){return null;};
 const reads=[];
 const recent=[listing("saved-part"),listing("other-part")];
 const {AccountDashboardContent}=moduleFrom("src/components/account-dashboard-content.tsx",{
  "@/components/product-card":{ProductCard},
  "@/lib/data/buyer-account":{getBuyerAccountCounts:async()=>accountCounts,getRecentlyViewedListings:async()=>recent},
  "@/lib/data/reputation":{getPublicMemberProfileById:async()=>null},
  "@/lib/data/listing-conversations":{getListingConversationCount:async()=>0},
  "@/lib/data/marketplace":{
   getSellerForOwner:async()=>null,
   getSavedPartIdsForParts:async(userId,partIds)=>{reads.push({userId,partIds});return ["saved-part"];}
  },
  "@/lib/data/fitting":{getGaragePartnerForOwner:async()=>null}
 });

 const tree=await AccountDashboardContent({userId:"viewer-1",role:"buyer",view:"buying"});
 const cards=nodes(tree).filter(node=>node.type===ProductCard);
 assert.deepEqual(reads,[{userId:"viewer-1",partIds:["saved-part","other-part"]}]);
 assert.deepEqual(cards.map(card=>({id:card.props.item.id,saved:card.props.saved,viewerId:card.props.viewerId})),[
  {id:"saved-part",saved:true,viewerId:"viewer-1"},
  {id:"other-part",saved:false,viewerId:"viewer-1"}
 ]);
});

test("recently viewed route passes current-viewer saved state to its visible cards and skips empty reads",async()=>{
 const ProductCard=function ProductCard(){return null;};
 const reads=[];
 let recent=[listing("saved-part"),listing("other-part")];
 const {default:RecentlyViewedPage}=moduleFrom("src/app/recently-viewed/page.tsx",{
  "@/components/header":{Header:component},
  "@/components/product-card":{ProductCard},
  "@/lib/auth":{requireUser:async()=>({id:"viewer-1"})},
  "@/lib/data/buyer-account":{getRecentlyViewedListings:async()=>recent},
  "@/lib/data/marketplace":{getSavedPartIdsForParts:async(userId,partIds)=>{reads.push({userId,partIds});return ["saved-part"];}}
 });

 let tree=await RecentlyViewedPage();
 let cards=nodes(tree).filter(node=>node.type===ProductCard);
 assert.deepEqual(reads,[{userId:"viewer-1",partIds:["saved-part","other-part"]}]);
 assert.deepEqual(cards.map(card=>({id:card.props.item.id,saved:card.props.saved,viewerId:card.props.viewerId})),[
  {id:"saved-part",saved:true,viewerId:"viewer-1"},
  {id:"other-part",saved:false,viewerId:"viewer-1"}
 ]);

 recent=[];
 tree=await RecentlyViewedPage();
 cards=nodes(tree).filter(node=>node.type===ProductCard);
 assert.equal(cards.length,0);
 assert.equal(reads.length,1);
});

function sellerRouteHarness(){
 const ProductCard=function ProductCard(){return null;};
 const reads=[];
 let viewer={id:"viewer-1"};
 let listings=[listing("saved-part"),listing("other-part")];
 const seller={
  id:"seller-1",ownerId:"seller-owner",slug:"qa-seller",businessName:"QA Seller",location:"Leeds",postcode:null,
  description:"Used automotive parts",verified:true,sellerType:"business",businessKind:"breaker"
 };
 const {default:SellerPage}=moduleFrom("src/app/seller/[slug]/page.tsx",{
  "next/navigation":{notFound(){throw new Error("Unexpected notFound");}},
  "@/components/header":{Header:component},
  "@/components/product-card":{ProductCard},
  "@/components/reputation-summary":{ReputationSummary:component},
  "@/components/review-list":{ReviewList:component},
  "@/lib/auth":{getCurrentUser:async()=>viewer},
  "@/lib/data/marketplace":{
   getPublicSellerInventorySummary:async()=>({activeCount:listings.length,testedCount:0,collectionCount:0,warrantyCount:0,categoryNames:[]}),
   getPublicSellerListingsPage:async()=>({data:listings,hasMore:false}),
   getSavedPartIdsForParts:async(userId,partIds)=>{reads.push({userId,partIds});return ["saved-part"];}
  },
  "@/lib/data/public-metadata":{getPublicSellerBySlug:async()=>seller},
  "@/lib/data/reputation":{getPublicMemberProfileById:async()=>null,getPublicMemberReviews:async()=>[]},
  "@/lib/seller-business":{sellerBusinessKindLabel:()=>"Vehicle recycler"},
  "@/lib/metadata":{buildSellerMetadata:()=>({})}
 });
 return {
  ProductCard,reads,SellerPage,
  setViewer(value){viewer=value;},
  setListings(value){listings=value;}
 };
}

test("public seller cards use the viewer rather than seller owner and remain available anonymously",async()=>{
 const harness=sellerRouteHarness();
 const props={params:Promise.resolve({slug:"qa-seller"}),searchParams:Promise.resolve({})};
 let tree=await harness.SellerPage(props);
 let cards=nodes(tree).filter(node=>node.type===harness.ProductCard);
 assert.deepEqual(harness.reads,[{userId:"viewer-1",partIds:["saved-part","other-part"]}]);
 assert.deepEqual(cards.map(card=>({id:card.props.item.id,saved:card.props.saved,viewerId:card.props.viewerId})),[
  {id:"saved-part",saved:true,viewerId:"viewer-1"},
  {id:"other-part",saved:false,viewerId:"viewer-1"}
 ]);
 assert.notEqual(harness.reads[0].userId,"seller-owner");

 harness.setViewer(null);
 tree=await harness.SellerPage(props);
 cards=nodes(tree).filter(node=>node.type===harness.ProductCard);
 assert.equal(harness.reads.length,1);
 assert.deepEqual(cards.map(card=>({saved:card.props.saved,viewerId:card.props.viewerId})),[
  {saved:false,viewerId:null},
  {saved:false,viewerId:null}
 ]);

 harness.setViewer({id:"viewer-2"});
 harness.setListings([]);
 tree=await harness.SellerPage(props);
 assert.equal(nodes(tree).filter(node=>node.type===harness.ProductCard).length,0);
 assert.equal(harness.reads.length,1);
});

test("saved route marks cards for its authenticated viewer identity",async()=>{
 const ProductCard=function ProductCard(){return null;};
 const {default:SavedPage}=moduleFrom("src/app/saved/page.tsx",{
  "@/components/header":{Header:component},
  "@/components/product-card":{ProductCard},
  "@/lib/auth":{requireUser:async()=>({id:"viewer-1"})},
  "@/lib/data/marketplace":{getSavedListingsPage:async()=>({data:[listing("saved-part")],error:null,pagination:{hasMore:false}})}
 });

 const tree=await SavedPage({searchParams:Promise.resolve({})});
 const card=nodes(tree).find(node=>node.type===ProductCard);
 assert.equal(card.props.saved,true);
 assert.equal(card.props.viewerId,"viewer-1");
});

test("part detail keys its local saved control to the authenticated server viewer",async()=>{
 const SaveButton=function SaveButton(){return null;};
 const listingItem={
  id:"part-1",slug:"part-one",sellerId:"seller-1",seller:{ownerId:"owner-1",slug:"seller",businessName:"Seller",location:"Leeds",verified:false,sellerType:"business"},
  images:[],condition:"used",stock:1,title:"Part one",pricePence:1000,shippingPence:0,collectionAvailable:false,
  deliveryDaysMin:null,deliveryDaysMax:null,description:"Description",category:{isTransmissionRelated:false},fitments:[],
  oemNumber:null,manufacturer:null,partNumber:null,gearboxFamily:null,gearboxCode:null
 };
 const {default:PartPage}=moduleFrom("src/app/parts/[slug]/page.tsx",{
  "next/navigation":{notFound(){throw new Error("Unexpected notFound");}},
  "@/components/ask-seller-form":{AskSellerForm:component},
  "@/components/buy-now-form":{BuyNowForm:component},
  "@/components/compatibility-badge":{CompatibilityBadge:component},
  "@/components/header":{Header:component},
  "@/components/marketplace-user-block-button":{MarketplaceUserBlockButton:component},
  "@/components/product-gallery":{ProductGallery:component},
  "@/components/part-passport":{PartPassport:component},
  "@/components/save-button":{SaveButton},
  "@/components/recently-viewed-tracker":{RecentlyViewedTracker:component},
  "@/lib/auth":{getCurrentUser:async()=>({id:"viewer-1"})},
  "@/lib/data/compatibility":{getPartCompatibility:async()=>null},
  "@/lib/data/checkout":{isSellerCheckoutReady:async()=>false},
  "@/lib/data/marketplace":{getSavedPartIdsForParts:async()=>["part-1"],getVehicleById:async()=>null},
  "@/lib/data/public-metadata":{getPublicListingBySlug:async()=>({data:listingItem,configured:true,error:null})},
  "@/lib/data/vehicle-catalogue":{getCatalogueSelection:async()=>null},
  "@/lib/data/reputation":{getPublicMemberProfileById:async()=>null},
  "@/lib/data/part-passport":{getPartPassportEvidence:async()=>null},
  "@/lib/listing-trust":{conditionLabel:value=>value},
  "@/lib/identifiers":{isUuid:()=>false},
  "@/lib/stripe-payments":{isStripeCheckoutConfigured:()=>false},
  "@/lib/marketplace-policy":{isMarketplaceUserBlocked:async()=>false},
  "@/lib/seller-geo":{getSellerDistanceFromPostcode:async()=>null},
  "@/lib/metadata":{buildListingJsonLd:()=>null,buildListingResultMetadata:()=>({}),serializeJsonLd:JSON.stringify}
 });

 const tree=await PartPage({params:Promise.resolve({slug:"part-one"}),searchParams:Promise.resolve({})});
 const saveButton=nodes(tree).find(node=>node.type===SaveButton);
 assert.equal(saveButton.key,"viewer-1");
 assert.equal(saveButton.props.viewerId,"viewer-1");
 assert.equal(saveButton.props.initialSaved,true);
});
