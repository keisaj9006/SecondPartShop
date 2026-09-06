import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

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
