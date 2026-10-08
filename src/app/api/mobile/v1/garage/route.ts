import { saveGarageVehicleForUser } from "@/lib/garage-save";
import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";


export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??20);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):20;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;

 const {data,error}=await supabase
  .from("garage_vehicles")
  .select("id,catalogue_variant_id,identity_make,identity_model,registration,year,fuel_type,engine_size_simple,colour,nickname,created_at,vehicle_catalogue_variants(make,model_family,variant)")
  .eq("profile_id",user.id)
  .order("created_at",{ascending:false})
  .order("id",{ascending:false})
  .range(offset,offset+limit);
 if(error)return mobileJson(request,{ok:false,error:"garage_unavailable"},503);
 const raw=data??[];
 const hasMore=raw.length>limit;
 const page=raw.slice(0,limit);

 const items=page.flatMap(row=>{
  const variant=one(row.vehicle_catalogue_variants);
  return [{
   id:row.id,
   catalogueVariantId:row.catalogue_variant_id,
   registration:row.registration,
   year:row.year,
   fuelType:row.fuel_type,
   engineSizeSimple:row.engine_size_simple,
   colour:row.colour,
   nickname:row.nickname,
   make:variant?.make??row.identity_make??"",
   model:variant?.model_family??row.identity_model??"",
   modelFamily:variant?.model_family??row.identity_model??"",
   variant:variant?.variant??null,
   createdAt:row.created_at
  }];
 });
 return mobileJson(request,{ok:true,items,pagination:{offset,limit,returned:items.length,hasMore}});
}

export async function POST(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;

 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"?payload as Record<string,unknown>:{};
 const result=await saveGarageVehicleForUser(supabase,request,input);
 if(!result.ok){
  const status=result.code==='lookup_rate_limited'?429:result.retryable?503:400;
  return mobileJson(request,{ok:false,error:result.code,message:result.message,retryable:result.retryable},status);
 }
 return mobileJson(request,{...result,created:result.outcome==='created'},result.outcome==='created'?201:200);
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
