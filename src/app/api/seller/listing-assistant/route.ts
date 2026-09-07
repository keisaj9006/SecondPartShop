import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateAiListingDraft,type AiListingContext } from "@/lib/ai-listing";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { validateImageUpload } from "@/lib/image-upload";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";
export const runtime="nodejs";

const MAX_AI_IMAGE_BYTES=2*1024*1024;
const text=(form:FormData,name:string,max:number)=>String(form.get(name)??"").trim().slice(0,max);

export async function POST(request:Request){
 const user=await getCurrentUser();
 if(!user)return NextResponse.json({message:"Sign in required."},{status:401,headers:{"cache-control":"no-store"}});
 const seller=await getSellerForOwner(user.id);
 if(!seller)return NextResponse.json({message:"Seller profile required."},{status:403,headers:{"cache-control":"no-store"}});
 if(!process.env.OPENAI_API_KEY?.trim()){
  return NextResponse.json({message:"AI Listing is not configured on this environment yet."},{status:503,headers:{"cache-control":"no-store"}});
 }

 let form:FormData;
 try{form=await request.formData();}catch{
  return NextResponse.json({message:"AI listing request could not be read."},{status:400,headers:{"cache-control":"no-store"}});
 }

 const context:AiListingContext={
  title:text(form,"title",200),
  description:text(form,"description",1600),
  categoryName:text(form,"categoryName",200),
  donorSummary:text(form,"donorSummary",300),
  condition:text(form,"condition",40),
  testingStatus:text(form,"testingStatus",80),
  warrantyDays:text(form,"warrantyDays",16),
  conditionNotes:text(form,"conditionNotes",500),
  damageNotes:text(form,"damageNotes",500),
  oemNumber:text(form,"oemNumber",180),
  manufacturer:text(form,"manufacturer",180),
  partNumber:text(form,"partNumber",180),
  gearboxFamily:text(form,"gearboxFamily",80),
  gearboxCode:text(form,"gearboxCode",80)
 };

 const imageValue=form.get("image");
 const image=imageValue instanceof File&&imageValue.size>0?imageValue:null;
 if(image&&image.size>MAX_AI_IMAGE_BYTES){
  return NextResponse.json({message:"AI photo preview must be 2 MB or smaller."},{status:413,headers:{"cache-control":"no-store"}});
 }

 const hasText=Object.values(context).some(value=>value.trim().length>0);
 if(!hasText&&!image){
  return NextResponse.json({message:"Add some listing details or a product photo before generating a draft."},{status:400,headers:{"cache-control":"no-store"}});
 }

 let imageDataUrl:string|undefined;
 if(image){
  try{
   const validated=await validateImageUpload(image);
   const bytes=Buffer.from(await image.arrayBuffer());
   imageDataUrl=`data:${validated.mimeType};base64,${bytes.toString("base64")}`;
  }catch(error){
   return NextResponse.json({message:error instanceof Error?error.message:"AI photo could not be validated."},{status:400,headers:{"cache-control":"no-store"}});
  }
 }

 const supabase=await createSupabaseServerClient();
 const {data:quota,error:quotaError}=await supabase.rpc("consume_ai_listing_quota");
 if(quotaError)return NextResponse.json({message:"AI Listing quota could not be checked."},{status:503,headers:{"cache-control":"no-store"}});
 const quotaRow=quota?.[0];
 if(!quotaRow?.allowed){
  return NextResponse.json({
   message:"AI Listing hourly limit reached. Continue editing manually and try AI again after the quota resets.",
   resetAt:quotaRow?.reset_at??null
  },{status:429,headers:{"cache-control":"no-store"}});
 }

 try{
  const draft=await generateAiListingDraft({context,imageDataUrl});
  return NextResponse.json({
   draft,
   quota:{remaining:Number(quotaRow.remaining??0),resetAt:quotaRow.reset_at}
  },{headers:{"cache-control":"private, no-store"}});
 }catch{
  return NextResponse.json({message:"AI Listing could not prepare a draft right now. Your listing was not changed."},{status:503,headers:{"cache-control":"no-store"}});
 }
}
