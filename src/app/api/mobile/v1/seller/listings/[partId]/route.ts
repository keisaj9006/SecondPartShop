import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";
import { canPublishMobileListing,listingRow,parseMobileListingInput,replaceMobileListingFitments,validateMobileListingInput } from "@/lib/mobile-seller-listing-write";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request,{params}:{params:Promise<{partId:string}>}){
 const {partId}=await params;
 if(!isUuid(partId))return mobileJson(request,{ok:false,error:"invalid_part"},400);

 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;

 const {data,error}=await supabase
  .from("parts")
  .select("id,slug,title,description,category_id,donor_vehicle_id,condition,price_pence,shipping_pence,stock,manufacturer,part_number,oem_number,gearbox_family,gearbox_code,dispatch_days,testing_status,warranty_days,condition_notes,damage_notes,collection_available,delivery_days_min,delivery_days_max,status,categories(name,is_transmission_related),part_images(id),part_catalogue_fitments(variant_id,year_from,year_to,fuel_type,engine_size_simple,notes,vehicle_catalogue_variants(make,model_family,variant))")
  .eq("id",partId)
  .eq("seller_id",auth.seller.id)
  .maybeSingle();
 if(error)return mobileJson(request,{ok:false,error:"listing_unavailable"},503);
 if(!data)return mobileJson(request,{ok:false,error:"not_found"},404);

 const category=one(data.categories);
 const imageCount=(data.part_images??[]).length;
 const exactFitmentCount=(data.part_catalogue_fitments??[]).length;
 const compatibilityEvidence=Boolean(data.donor_vehicle_id||exactFitmentCount||data.oem_number||(data.manufacturer&&data.part_number));
 const missing=[
  ...(data.stock<1?["stock_available"]:[]),
  ...(imageCount<1?["real_product_photo"]:[]),
  ...(!compatibilityEvidence?["compatibility_or_part_identity_evidence"]:[])
 ];
 return mobileJson(request,{ok:true,item:{
  id:data.id,
  slug:data.slug,
  title:data.title,
  description:data.description,
  categoryId:data.category_id,
  categoryName:category?.name??null,
  transmissionRelated:Boolean(category?.is_transmission_related),
  donorVehicleId:data.donor_vehicle_id,
  condition:data.condition,
  pricePence:data.price_pence,
  shippingPence:data.shipping_pence,
  stock:data.stock,
  manufacturer:data.manufacturer,
  partNumber:data.part_number,
  oemNumber:data.oem_number,
  gearboxFamily:data.gearbox_family,
  gearboxCode:data.gearbox_code,
  dispatchDays:data.dispatch_days,
  testingStatus:data.testing_status,
  warrantyDays:data.warranty_days,
  conditionNotes:data.condition_notes,
  damageNotes:data.damage_notes,
  collectionAvailable:data.collection_available,
  deliveryDaysMin:data.delivery_days_min,
  deliveryDaysMax:data.delivery_days_max,
  status:data.status,
  imageCount,
  publishReadiness:{ready:missing.length===0,missing},
  catalogueFitments:(data.part_catalogue_fitments??[]).flatMap(fitment=>{
   if(fitment.year_from===null||fitment.year_to===null||fitment.year_from!==fitment.year_to)return [];
   const vehicle=one(fitment.vehicle_catalogue_variants);
   return [{
    variantId:fitment.variant_id,
    year:fitment.year_from,
    fuelType:fitment.fuel_type,
    engineSizeSimple:fitment.engine_size_simple,
    notes:fitment.notes,
    make:vehicle?.make??null,
    modelFamily:vehicle?.model_family??null,
    variant:vehicle?.variant??null
   }];
  })
 }});
}

export async function PATCH(request:Request,{params}:{params:Promise<{partId:string}>}){
 const {partId}=await params;
 if(!isUuid(partId))return mobileJson(request,{ok:false,error:"invalid_part"},400);

 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;

 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const raw=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const requestedStatus=raw.status==="active"?"active":"draft";

 try{
  const parsed=parseMobileListingInput(body);
  const value=await validateMobileListingInput(supabase,auth.seller.id,parsed);

  const {data:existing,error:existingError}=await supabase
   .from("parts")
   .select("id,status")
   .eq("id",partId)
   .eq("seller_id",auth.seller.id)
   .maybeSingle();
  if(existingError)return mobileJson(request,{ok:false,error:"listing_unavailable"},503);
  if(!existing)return mobileJson(request,{ok:false,error:"not_found"},404);
  if(existing.status==="reserved")return mobileJson(request,{ok:false,error:"listing_reserved"},409);
  if(requestedStatus==="active"&&value.stock<1)throw new Error("stock_required");

  const holdDraft=requestedStatus==="active";
  const {error:updateError}=await supabase
   .from("parts")
   .update({...listingRow(value),status:holdDraft?"draft":requestedStatus})
   .eq("id",partId)
   .eq("seller_id",auth.seller.id);
  if(updateError)return mobileJson(request,{ok:false,error:"listing_update_failed"},503);

  await replaceMobileListingFitments(supabase,partId,value.catalogueFitments);

  if(requestedStatus==="active"){
   await canPublishMobileListing(supabase,partId,value);
   const {error:publishError}=await supabase
    .from("parts")
    .update({status:"active"})
    .eq("id",partId)
    .eq("seller_id",auth.seller.id);
   if(publishError)throw new Error("publish_failed");
  }

  return mobileJson(request,{ok:true,id:partId,status:requestedStatus});
 }catch(error){
  const code=error instanceof Error?error.message:"listing_update_failed";
  const status=["photo_required","compatibility_evidence_required","stock_required","listing_reserved"].includes(code)?409:400;
  const known=[
   "title_too_short","description_too_short","invalid_category","invalid_condition","invalid_testing",
   "invalid_price","invalid_shipping","invalid_stock","invalid_dispatch","invalid_warranty",
   "invalid_delivery_range","invalid_donor","transmission_codes_required","invalid_fitments",
   "duplicate_fitment","fitment_save_failed","photo_required","compatibility_evidence_required","stock_required","listing_reserved",
   "publish_check_failed","publish_failed"
  ];
  return mobileJson(request,{ok:false,error:known.includes(code)?code:"listing_update_failed"},status);
 }
}
