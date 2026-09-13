import type { MetadataRoute } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";
import { buildSitemapEntries,type SitemapRow } from "@/lib/sitemap";

export const dynamic="force-dynamic";

const PAGE_SIZE=1000;

type RawSitemapRow={
 slug:string;
 updated_at:string|null;
 sellers:{slug:string}|Array<{slug:string}>|null;
};

function sellerSlug(value:RawSitemapRow["sellers"]){
 if(Array.isArray(value))return value[0]?.slug??"";
 return value?.slug??"";
}

async function loadSitemapRows():Promise<SitemapRow[]>{
 if(!isSupabaseConfigured())return [];
 try{
  const supabase=createSupabasePublicServerClient();
  const rows:SitemapRow[]=[];
  for(let offset=0;;offset+=PAGE_SIZE){
   const {data,error}=await supabase
    .from("parts")
    .select("slug,updated_at,sellers!inner(slug)")
    .eq("status","active")
    .order("id",{ascending:true})
    .range(offset,offset+PAGE_SIZE-1);
   if(error)return [];
   const page=(data??[]) as unknown as RawSitemapRow[];
   for(const row of page){
    const linkedSeller=sellerSlug(row.sellers).trim();
    if(!linkedSeller)continue;
    rows.push({partSlug:row.slug,partUpdatedAt:row.updated_at,sellerSlug:linkedSeller});
   }
   if(page.length<PAGE_SIZE)break;
  }
  return rows;
 }catch{
  return [];
 }
}

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 return buildSitemapEntries(await loadSitemapRows());
}
