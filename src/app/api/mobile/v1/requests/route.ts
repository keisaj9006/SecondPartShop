import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";
import { isPlausibleUkRegistration,normalizeRegistration } from "@/lib/vehicle-registration";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 const [{data,error},{data:matchRows,error:matchError}]=await Promise.all([
  supabase
   .from("part_requests")
   .select("id,query_text,oem_number,notes,status,registration,year,fuel_type,engine_size_simple,created_at,categories(name),vehicle_catalogue_variants(make,model_family,variant)")
   .eq("profile_id",user.id)
   .order("created_at",{ascending:false}),
  supabase.rpc("buyer_part_request_match_counts")
 ]);
 if(error||matchError)return mobileJson(request,{ok:false,error:"part_requests_unavailable"},503);
 const matchMap=new Map((matchRows??[]).map(row=>[row.request_id,{
  matching:Number(row.matching_seller_count??0),
  verified:Number(row.verified_seller_count??0)
 }] as const));

 return mobileJson(request,{ok:true,items:(data??[]).map(row=>{
  const category=one(row.categories);
  const vehicle=one(row.vehicle_catalogue_variants);
  return {
   id:row.id,
   queryText:row.query_text,
   oemNumber:row.oem_number,
   notes:row.notes,
   status:row.status,
   registration:row.registration,
   year:row.year,
   fuelType:row.fuel_type,
   engineSizeSimple:row.engine_size_simple,
   createdAt:row.created_at,
   categoryName:category?.name??null,
   vehicleLabel:vehicle
    ?[vehicle.make+" "+vehicle.model_family,row.year?String(row.year):null,row.engine_size_simple?String(row.engine_size_simple)+"cc":null,row.fuel_type].filter(Boolean).join(" · ")
    :null,
   matchingSellerCount:matchMap.get(row.id)?.matching??0,
   verifiedSellerCount:matchMap.get(row.id)?.verified??0
  };
 })});
}

export async function POST(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=body&&typeof body==="object"?body as Record<string,unknown>:{};

 const queryText=String(input.queryText??"").trim().slice(0,160);
 const oemNumber=String(input.oemNumber??"").trim().slice(0,80)||null;
 const notes=String(input.notes??"").trim().slice(0,1000)||null;
 const categoryId=isUuid(String(input.categoryId??""))?String(input.categoryId):null;
 const variantId=isUuid(String(input.variantId??""))?String(input.variantId):null;
 const yearRaw=Number(input.year);
 const year=Number.isInteger(yearRaw)&&yearRaw>=1900&&yearRaw<=2100?yearRaw:null;
 const fuelType=String(input.fuelType??"").trim().slice(0,100)||null;
 const engineRaw=Number(input.engineSizeSimple);
 const engine=Number.isInteger(engineRaw)&&engineRaw>=100&&engineRaw<=10000?engineRaw:null;
 const rawRegistration=String(input.registration??"").trim();
 const registration=rawRegistration?normalizeRegistration(rawRegistration):null;

 if(queryText.length<3)return mobileJson(request,{ok:false,error:"part_request_query_required"},400);
 if(registration&&!isPlausibleUkRegistration(registration))return mobileJson(request,{ok:false,error:"invalid_registration"},400);

 const {data,error}=await supabase.from("part_requests").insert({
  profile_id:user.id,
  category_id:categoryId,
  catalogue_variant_id:variantId,
  registration,
  year,
  fuel_type:fuelType,
  engine_size_simple:engine,
  query_text:queryText,
  oem_number:oemNumber,
  notes
 }).select("id").single();

 if(error||!data)return mobileJson(request,{ok:false,error:"part_request_create_failed"},503);
 return mobileJson(request,{ok:true,id:data.id},201);
}

export async function PATCH(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const id=String(input.id??"");
 if(!isUuid(id))return mobileJson(request,{ok:false,error:"invalid_part_request"},400);
 const {error}=await supabase.from("part_requests")
  .update({status:"closed",updated_at:new Date().toISOString()})
  .eq("id",id).eq("profile_id",user.id);
 if(error)return mobileJson(request,{ok:false,error:"part_request_close_failed"},503);
 return mobileJson(request,{ok:true,closed:true});
}

export async function DELETE(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 const id=new URL(request.url).searchParams.get("id")??"";
 if(!isUuid(id))return mobileJson(request,{ok:false,error:"invalid_part_request"},400);
 const {error}=await supabase.from("part_requests").delete().eq("id",id).eq("profile_id",user.id);
 if(error)return mobileJson(request,{ok:false,error:"part_request_delete_failed"},503);
 return mobileJson(request,{ok:true,deleted:true});
}
