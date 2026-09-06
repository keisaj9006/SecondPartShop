import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";
import { listingRow,parseMobileListingInput,replaceMobileListingFitments,slugifyMobileListing,validateMobileListingInput } from "@/lib/mobile-seller-listing-write";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const seller=auth.seller;

 const {data,error}=await supabase
  .from("parts")
  .select("id,slug,title,status,stock,price_pence,condition,testing_status,warranty_days,donor_vehicle_id,created_at,updated_at,part_images(id,storage_path,alt_text,position)")
  .eq("seller_id",seller.id)
  .order("updated_at",{ascending:false});
 if(error)return mobileJson(request,{ok:false,error:"inventory_unavailable"},503);

 const urlBase=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"")??"";
 const publicUrl=(path:string)=>urlBase+"/storage/v1/object/public/part-images/"+path.split("/").map(encodeURIComponent).join("/");

 return mobileJson(request,{
  ok:true,
  items:(data??[]).map(item=>({
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
   createdAt:item.created_at,
   updatedAt:item.updated_at,
   images:(item.part_images??[]).sort((a,b)=>a.position-b.position).map(image=>({
    id:image.id,
    url:publicUrl(image.storage_path),
    alt:image.alt_text,
    position:image.position
   }))
  }))
 });
}


export async function POST(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;

 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}

 try{
  const input=body&&typeof body==="object"&&!Array.isArray(body)?body as Record<string,unknown>:{};
  const rawSourceRequestId=String(input.sourceRequestId??"").trim();
  let sourceRequestId:string|null=null;
  if(isUuid(rawSourceRequestId)){
   const {data:lead}=await supabase.from("seller_part_request_leads").select("request_id").eq("request_id",rawSourceRequestId).eq("status","open").maybeSingle();
   sourceRequestId=lead?.request_id??null;
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
