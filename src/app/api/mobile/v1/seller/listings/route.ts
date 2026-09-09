import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileMarketplaceTermsAccepted,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";
import { mobileThumbnailUrl } from "@/lib/mobile-image";
import { listingRow,parseMobileListingInput,replaceMobileListingFitments,slugifyMobileListing,validateMobileListingInput } from "@/lib/mobile-seller-listing-write";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const seller=auth.seller;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??40);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,100)):40;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;
 const search=url.searchParams.get("q")?.trim().slice(0,120)??"";
 const status=url.searchParams.get("status")?.trim()??"";
 const sourceChannel=url.searchParams.get("source")?.trim()??"";
 const importBatchId=url.searchParams.get("importBatch")?.trim()??"";
 const validStatuses=["draft","active","reserved","sold","archived"];
 const validSources=["manual","csv","ebay","api"];

 let query=supabase
  .from("parts")
  .select("id,slug,title,status,stock,price_pence,condition,testing_status,warranty_days,donor_vehicle_id,source_channel,source_external_id,import_batch_id,created_at,updated_at")
  .eq("seller_id",seller.id)
  .order("updated_at",{ascending:false})
  .order("id");

 if(search){
  const escaped=search.replaceAll("%","\\%").replaceAll("_","\\_");
  query=query.or(`title.ilike.%${escaped}%,oem_number.ilike.%${escaped}%,part_number.ilike.%${escaped}%,manufacturer.ilike.%${escaped}%,source_external_id.ilike.%${escaped}%`);
 }
 if(validStatuses.includes(status))query=query.eq("status",status as "draft"|"active"|"reserved"|"sold"|"archived");
 if(validSources.includes(sourceChannel))query=query.eq("source_channel",sourceChannel as "manual"|"csv"|"ebay"|"api");
 if(isUuid(importBatchId))query=query.eq("import_batch_id",importBatchId);

 const {data,error}=await query.range(offset,offset+limit);
 if(error)return mobileJson(request,{ok:false,error:"inventory_unavailable"},503);
 const raw=data??[];
 const hasMore=raw.length>limit;
 const page=raw.slice(0,limit);
 const ids=page.map(item=>item.id);
 const {data:coverRows,error:coverError}=ids.length
  ?await supabase.from("part_images").select("id,part_id,storage_path,alt_text,position").in("part_id",ids).eq("position",0)
  :{data:[],error:null};
 if(coverError)return mobileJson(request,{ok:false,error:"inventory_images_unavailable"},503);
 const covers=new Map((coverRows??[]).map(image=>[image.part_id,image] as const));

 const urlBase=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"")??"";
 const publicUrl=(path:string)=>urlBase+"/storage/v1/object/public/part-images/"+path.split("/").map(encodeURIComponent).join("/");

 return mobileJson(request,{
  ok:true,
  items:page.map(item=>{
   const image=covers.get(item.id);
   return {
    id:item.id,
    slug:item.slug,
    title:item.title,
    status:item.status,
    stock:item.stock,
    pricePence:item.price_pence,
    condition:item.condition,
    testingStatus:item.testing_status,
    warrantyDays:item.warranty_days,
    donorVehicleId:item.donor_vehicle_id,
    sourceChannel:item.source_channel,
    sellerReference:item.source_external_id,
    importBatchId:item.import_batch_id,
    createdAt:item.created_at,
    updatedAt:item.updated_at,
    images:image?[{
     id:image.id,
     url:publicUrl(image.storage_path),
     thumbnailUrl:mobileThumbnailUrl(request,publicUrl(image.storage_path)),
     alt:image.alt_text,
     position:image.position
    }]:[]
   };
  }),
  pagination:{offset,limit,returned:page.length,hasMore}
 });
}


export async function POST(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 if(!await mobileMarketplaceTermsAccepted(auth.context))return mobileJson(request,{ok:false,error:"terms_required"},428);

 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}

 try{
  const input=body&&typeof body==="object"&&!Array.isArray(body)?body as Record<string,unknown>:{};
  const rawSourceRequestId=String(input.sourceRequestId??"").trim();
  let sourceRequestId:string|null=null;
  if(isUuid(rawSourceRequestId)){
   const {data:lead,error:leadError}=await supabase.rpc("seller_part_request_lead",{p_request_id:rawSourceRequestId});
   if(leadError)throw new Error("request_lead_validation_failed");
   sourceRequestId=lead?.[0]?.request_id??null;
  }
  const parsed=parseMobileListingInput(body);
  const value=await validateMobileListingInput(supabase,auth.seller.id,parsed);
  const slug=`${slugifyMobileListing(value.title)}-${crypto.randomUUID().slice(0,8)}`;
  const {data,error}=await supabase
   .from("parts")
   .insert({...listingRow(value),seller_id:auth.seller.id,source_request_id:sourceRequestId,status:"draft",slug})
   .select("id,slug")
   .single();
  if(error||!data)return mobileJson(request,{ok:false,error:"listing_create_failed"},503);

  try{
   await replaceMobileListingFitments(supabase,data.id,value.catalogueFitments);
  }catch(error){
   await supabase.from("parts").delete().eq("id",data.id).eq("seller_id",auth.seller.id);
   throw error;
  }

  return mobileJson(request,{ok:true,id:data.id,slug:data.slug,status:"draft"},201);
 }catch(error){
  const code=error instanceof Error?error.message:"listing_create_failed";
  const known=[
   "title_too_short","description_too_short","invalid_category","invalid_condition","invalid_testing",
   "invalid_price","invalid_shipping","invalid_stock","invalid_dispatch","invalid_warranty",
   "invalid_delivery_range","invalid_donor","transmission_codes_required","invalid_fitments",
   "duplicate_fitment","fitment_save_failed"
  ];
  return mobileJson(request,{ok:false,error:known.includes(code)?code:"listing_create_failed"},400);
 }
}
