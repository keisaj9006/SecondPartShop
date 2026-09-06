import { getCatalogueSelection } from "@/lib/data/vehicle-catalogue";
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

 const {data,error}=await supabase
  .from("garage_vehicles")
  .select("id,catalogue_variant_id,registration,year,fuel_type,engine_size_simple,colour,nickname,created_at,vehicle_catalogue_variants!inner(make,model_family,variant)")
  .eq("profile_id",user.id)
  .order("created_at",{ascending:false});
 if(error)return mobileJson(request,{ok:false,error:"garage_unavailable"},503);

 return mobileJson(request,{
  ok:true,
  items:(data??[]).flatMap(row=>{
   const variant=one(row.vehicle_catalogue_variants);
   if(!variant)return [];
   return [{
    id:row.id,
    catalogueVariantId:row.catalogue_variant_id,
    registration:row.registration,
    year:row.year,
    fuelType:row.fuel_type,
    engineSizeSimple:row.engine_size_simple,
    colour:row.colour,
    nickname:row.nickname,
    make:variant.make,
    modelFamily:variant.model_family,
    variant:variant.variant,
    createdAt:row.created_at
   }];
  })
 });
}

export async function POST(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"?payload as Record<string,unknown>:{};
 const variantId=String(input.variantId??"");
 const year=Number(input.year);
 const fuel=String(input.fuel??"").trim()||undefined;
 const engineRaw=input.engine;
 const engine=engineRaw===undefined||engineRaw===null||engineRaw===""?undefined:Number(engineRaw);
 const rawRegistration=String(input.registration??"").trim();
 const registration=rawRegistration?normalizeRegistration(rawRegistration):null;
 const nickname=String(input.nickname??"").trim().slice(0,50)||null;
 const colour=String(input.colour??"").trim().slice(0,40)||null;

 if(!isUuid(variantId)||!Number.isInteger(year))return mobileJson(request,{ok:false,error:"invalid_vehicle"},400);
 if(registration&&!isPlausibleUkRegistration(registration))return mobileJson(request,{ok:false,error:"invalid_registration"},400);
 if(engine!==undefined&&!Number.isInteger(engine))return mobileJson(request,{ok:false,error:"invalid_engine"},400);

 const selection=await getCatalogueSelection(variantId,year,fuel,engine).catch(()=>null);
 if(!selection)return mobileJson(request,{ok:false,error:"vehicle_not_found"},404);

 const {data:existing,error:readError}=await supabase
  .from("garage_vehicles")
  .select("id,registration,fuel_type,engine_size_simple,colour,nickname")
  .eq("profile_id",user.id)
  .eq("catalogue_variant_id",variantId)
  .eq("year",year);
 if(readError)return mobileJson(request,{ok:false,error:"garage_unavailable"},503);

 const duplicate=(existing??[]).find(row=>
  (row.registration??null)===(registration??null)&&
  (row.fuel_type??null)===(selection.fuelType??null)&&
  (row.engine_size_simple??null)===(selection.engineSizeSimple??null)
 );

 if(duplicate){
  if((colour&&!duplicate.colour)||(nickname&&!duplicate.nickname)){
   const {error:updateError}=await supabase
    .from("garage_vehicles")
    .update({colour:duplicate.colour??colour,nickname:duplicate.nickname??nickname})
    .eq("id",duplicate.id)
    .eq("profile_id",user.id);
   if(updateError)return mobileJson(request,{ok:false,error:"garage_save_failed"},503);
  }
  return mobileJson(request,{ok:true,id:duplicate.id,created:false});
 }

 const {data:created,error}=await supabase
  .from("garage_vehicles")
  .insert({
   profile_id:user.id,
   catalogue_variant_id:variantId,
   registration,
   year,
   fuel_type:selection.fuelType,
   engine_size_simple:selection.engineSizeSimple,
   colour,
   nickname
  })
  .select("id")
  .single();
 if(error||!created)return mobileJson(request,{ok:false,error:"garage_save_failed"},503);

 return mobileJson(request,{ok:true,id:created.id,created:true},201);
}

export async function DELETE(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 const url=new URL(request.url);
 const id=url.searchParams.get("id")??"";
 if(!isUuid(id))return mobileJson(request,{ok:false,error:"invalid_vehicle"},400);

 const {error}=await supabase
  .from("garage_vehicles")
  .delete()
  .eq("id",id)
  .eq("profile_id",user.id);
 if(error)return mobileJson(request,{ok:false,error:"garage_delete_failed"},503);

 return mobileJson(request,{ok:true,deleted:true,id});
}
