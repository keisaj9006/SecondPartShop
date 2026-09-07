import { generateAiListingDraft,type AiListingContext } from "@/lib/ai-listing";
import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const clean=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

export async function POST(request:Request){
 if(!process.env.OPENAI_API_KEY?.trim()){
  return mobileJson(request,{ok:false,error:"ai_listing_not_configured"},503);
 }

 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;

 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload as Record<string,unknown>:{};

 const context:AiListingContext={
  title:clean(input.title,200),
  description:clean(input.description,1600),
  categoryName:clean(input.categoryName,200),
  donorSummary:clean(input.donorSummary,300),
  condition:clean(input.condition,40),
  testingStatus:clean(input.testingStatus,80),
  warrantyDays:clean(input.warrantyDays,16),
  conditionNotes:clean(input.conditionNotes,500),
  damageNotes:clean(input.damageNotes,500),
  oemNumber:clean(input.oemNumber,180),
  manufacturer:clean(input.manufacturer,180),
  partNumber:clean(input.partNumber,180),
  gearboxFamily:clean(input.gearboxFamily,80),
  gearboxCode:clean(input.gearboxCode,80)
 };

 const partId=clean(input.partId,80);
 let imageDataUrl:string|undefined;
 let imageUsed=false;

 if(isUuid(partId)){
  const {data:part}=await supabase
   .from("parts")
   .select("id")
   .eq("id",partId)
   .eq("seller_id",auth.seller.id)
   .maybeSingle();
  if(!part)return mobileJson(request,{ok:false,error:"listing_not_found"},404);

  const {data:image}=await supabase
   .from("part_images")
   .select("storage_path")
   .eq("part_id",part.id)
   .order("position")
   .limit(1)
   .maybeSingle();

  if(image?.storage_path){
   const {data:file}=await supabase.storage.from("part-images").download(image.storage_path);
   if(file&&file.size>0&&file.size<=5*1024*1024&&["image/jpeg","image/png","image/webp"].includes(file.type)){
    const bytes=Buffer.from(await file.arrayBuffer());
    imageDataUrl=`data:${file.type};base64,${bytes.toString("base64")}`;
    imageUsed=true;
   }
  }
 }

 if(!Object.values(context).some(value=>value.trim())&&!imageDataUrl){
  return mobileJson(request,{ok:false,error:"ai_listing_context_required"},400);
 }

 const {data:quota,error:quotaError}=await supabase.rpc("consume_ai_listing_quota");
 if(quotaError)return mobileJson(request,{ok:false,error:"ai_listing_quota_unavailable"},503);
 const quotaRow=quota?.[0];
 if(!quotaRow?.allowed){
  return mobileJson(request,{ok:false,error:"ai_listing_rate_limited",resetAt:quotaRow?.reset_at??null},429);
 }

 try{
  const draft=await generateAiListingDraft({context,imageDataUrl});
  return mobileJson(request,{
   ok:true,
   draft,
   imageUsed,
   quota:{remaining:Number(quotaRow.remaining??0),resetAt:quotaRow.reset_at}
  });
 }catch{
  return mobileJson(request,{ok:false,error:"ai_listing_unavailable"},503);
 }
}
