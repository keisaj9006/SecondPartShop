import type { Metadata } from "next";
import type { Listing,Seller } from "@/lib/types";
import type { DataResult } from "@/lib/data/marketplace";

export type MetadataEnvironment={vercelEnv?:string;siteUrl?:string};

const siteName="SecondPart";
const homeTitle="Used & recycled car parts for your vehicle | SecondPart";
const homeDescription="Search used and recycled automotive parts from UK sellers, compare fitment evidence, and buy through SecondPart.";
const noIndex:Metadata["robots"]={index:false,follow:false};

const publicEnvironment=():MetadataEnvironment=>({
 vercelEnv:process.env.VERCEL_ENV,
 siteUrl:process.env.NEXT_PUBLIC_SITE_URL
});

function publicText(value:string|undefined|null,maxLength:number){
 const text=String(value??"")
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi," ")
  .replace(/<[^>]*>/g," ")
  .replace(/\s+/g," ")
  .trim();
 if(text.length<=maxLength)return text;
 return `${text.slice(0,Math.max(0,maxLength-1)).trimEnd()}…`;
}

function isBlockedHostname(hostname:string){
 const host=hostname.toLowerCase().replace(/\.$/,"");
 return host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")
  ||/^127(?:\.|$)/.test(host)||host==="0.0.0.0"||host==="[::1]"
  ||/^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
  ||host.includes("preview")||host.endsWith(".vercel.app")||!host.includes(".");
}

function isIpLiteral(hostname:string){
 const host=hostname.toLowerCase().replace(/\.$/,"");
 return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)||(host.startsWith("[")&&host.endsWith("]"));
}

export function getApprovedProductionOrigin(environment:MetadataEnvironment=publicEnvironment()){
 if(environment.vercelEnv!=="production")return null;
 const configured=environment.siteUrl?.trim();
 if(!configured)return null;
 try{
  const url=new URL(configured);
  if(url.protocol!=="https:"||url.username||url.password||url.port||url.pathname!=="/"||url.search||url.hash||isIpLiteral(url.hostname)||isBlockedHostname(url.hostname))return null;
  return url.origin;
 }catch{return null;}
}

function absoluteRoute(path:string,environment:MetadataEnvironment){
 const origin=getApprovedProductionOrigin(environment);
 return origin?new URL(path,`${origin}/`).toString():null;
}

function publicRobots(environment:MetadataEnvironment):Metadata["robots"]|undefined{
 return environment.vercelEnv==="production"?undefined:noIndex;
}

function safeImageUrls(listing:Listing){
 return listing.images.flatMap(image=>{
  try{
   const url=new URL(image.url);
   return url.protocol==="https:"&&!url.username&&!url.password&&!isBlockedHostname(url.hostname)?[url.toString()]:[];
  }catch{return [];}
 });
}

export function buildRootMetadata(environment:MetadataEnvironment=publicEnvironment()):Metadata{
 return {
  title:siteName,
  description:homeDescription,
  applicationName:siteName,
  manifest:"/manifest.webmanifest",
  icons:{
   icon:[
    {url:"/icons/icon-192.svg",type:"image/svg+xml",sizes:"192x192"},
    {url:"/icons/icon-512.svg",type:"image/svg+xml",sizes:"512x512"}
   ],
   apple:[{url:"/icons/icon-192.svg",type:"image/svg+xml",sizes:"192x192"}]
  },
  appleWebApp:{capable:true,title:siteName,statusBarStyle:"default"},
  robots:publicRobots(environment)
 };
}

export function buildHomeMetadata(environment:MetadataEnvironment=publicEnvironment()):Metadata{
 const canonical=absoluteRoute("/",environment);
 return {
  title:homeTitle,
  description:homeDescription,
  robots:publicRobots(environment),
  alternates:canonical?{canonical}:undefined,
  openGraph:{type:"website",siteName,title:homeTitle,description:homeDescription,url:canonical??undefined}
 };
}

export function buildPrivateMetadata(title:string,description:string):Metadata{
 return {title:`${publicText(title,70)} | ${siteName}`,description:publicText(description,160),robots:noIndex};
}

function unavailableMetadata(label:string,description:string):Metadata{
 return {title:`${label} unavailable | ${siteName}`,description,robots:noIndex};
}

export function buildListingMetadata(listing:Listing,environment:MetadataEnvironment=publicEnvironment()):Metadata{
 const title=`${publicText(listing.title,70)} | ${siteName}`;
 const description=publicText(listing.description,160)||`View this ${listing.condition} automotive part from ${publicText(listing.seller.businessName,60)} on SecondPart.`;
 const canonical=absoluteRoute(`/parts/${encodeURIComponent(listing.slug)}`,environment);
 const images=safeImageUrls(listing);
 return {
  title,description,robots:publicRobots(environment),alternates:canonical?{canonical}:undefined,
  openGraph:{type:"website",siteName,title,description,url:canonical??undefined,images:images.length?images:undefined}
 };
}

export function buildListingResultMetadata(result:DataResult<Listing|null>|null,environment:MetadataEnvironment=publicEnvironment()):Metadata{
 return result?.data?buildListingMetadata(result.data,environment):unavailableMetadata("Part","This SecondPart listing is unavailable.");
}

export function buildSellerMetadata(seller:Seller|null,environment:MetadataEnvironment=publicEnvironment()):Metadata{
 if(!seller)return unavailableMetadata("Seller","This SecondPart seller profile is unavailable.");
 const sellerName=publicText(seller.businessName,70)||"Seller";
 const title=`${sellerName} | ${siteName}`;
 const detail=publicText(seller.description,110);
 const description=publicText(`${sellerName} in ${publicText(seller.location,50)}.${detail?` ${detail}`:""}`,160);
 const canonical=absoluteRoute(`/seller/${encodeURIComponent(seller.slug)}`,environment);
 return {title,description,robots:publicRobots(environment),alternates:canonical?{canonical}:undefined,openGraph:{type:"website",siteName,title,description,url:canonical??undefined}};
}

const schemaCondition:Record<Listing["condition"],string>={
 new:"https://schema.org/NewCondition",
 reconditioned:"https://schema.org/RefurbishedCondition",
 used:"https://schema.org/UsedCondition"
};

export function buildListingJsonLd(listing:Listing,environment:MetadataEnvironment=publicEnvironment()):Record<string,unknown>|null{
 if(listing.status!=="active")return null;
 const canonical=absoluteRoute(`/parts/${encodeURIComponent(listing.slug)}`,environment);
 const images=safeImageUrls(listing);
 const description=publicText(listing.description,500);
 const offer:Record<string,unknown>={
  "@type":"Offer",
  price:(listing.pricePence/100).toFixed(2),
  priceCurrency:"GBP",
  itemCondition:schemaCondition[listing.condition],
  availability:listing.stock>0?"https://schema.org/InStock":"https://schema.org/OutOfStock"
 };
 const product:Record<string,unknown>={"@type":"Product",name:publicText(listing.title,200),offers:offer};
 if(description)product.description=description;
 if(images.length)product.image=images;
 if(!canonical)return {"@context":"https://schema.org",...product};
 product["@id"]=`${canonical}#product`;
 product.url=canonical;
 offer["@id"]=`${canonical}#offer`;
 offer.url=canonical;
 return {
  "@context":"https://schema.org",
  "@graph":[
   product,
   {"@type":"BreadcrumbList",itemListElement:[
    {"@type":"ListItem",position:1,name:siteName,item:new URL("/",canonical).toString()},
    {"@type":"ListItem",position:2,name:publicText(listing.title,200),item:canonical}
   ]}
  ]
 };
}

export function serializeJsonLd(value:unknown){
 return JSON.stringify(value).replace(/</g,"\\u003c");
}
