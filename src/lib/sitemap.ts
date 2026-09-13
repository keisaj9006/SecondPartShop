import type { MetadataRoute } from "next";
import { getApprovedProductionOrigin,type MetadataEnvironment } from "@/lib/metadata";

export type SitemapRow={
 partSlug:string;
 partUpdatedAt:string|null;
 sellerSlug:string;
};

function validTimestamp(value:string|null){
 if(!value)return null;
 return Number.isNaN(Date.parse(value))?null:value;
}

export function buildSitemapEntries(
 rows:SitemapRow[],
 environment?:MetadataEnvironment
):MetadataRoute.Sitemap{
 const origin=getApprovedProductionOrigin(environment);
 if(!origin)return [];

 const entries:MetadataRoute.Sitemap=[{
  url:`${origin}/`,
  changeFrequency:"daily",
  priority:1
 }];
 const sellers=new Map<string,string|null>();

 for(const row of rows){
  const partSlug=String(row.partSlug||"").trim();
  const sellerSlug=String(row.sellerSlug||"").trim();
  const updatedAt=validTimestamp(row.partUpdatedAt);
  if(partSlug){
   entries.push({
    url:new URL(`/parts/${encodeURIComponent(partSlug)}`,`${origin}/`).toString(),
    ...(updatedAt?{lastModified:updatedAt}:{}),
    changeFrequency:"daily",
    priority:0.8
   });
  }
  if(sellerSlug){
   const previous=sellers.get(sellerSlug)??null;
   if(!sellers.has(sellerSlug)||(!previous&&updatedAt)||(previous&&updatedAt&&Date.parse(updatedAt)>Date.parse(previous))){
    sellers.set(sellerSlug,updatedAt);
   }
  }
 }

 for(const [slug,updatedAt] of sellers){
  entries.push({
   url:new URL(`/seller/${encodeURIComponent(slug)}`,`${origin}/`).toString(),
   ...(updatedAt?{lastModified:updatedAt}:{}),
   changeFrequency:"weekly",
   priority:0.6
  });
 }
 return entries;
}
