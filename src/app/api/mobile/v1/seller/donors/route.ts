import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";
import { isPlausibleUkRegistration,normalizeRegistration } from "@/lib/vehicle-registration";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??40);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,100)):40;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;
 const search=url.searchParams.get("q")?.trim().slice(0,80)??"";

 let query=supabase
  .from("donor_vehicles")
  .select("id,registration,make,model,variant,year,fuel_type,engine_size_simple,colour,notes,created_at")
  .eq("seller_id",auth.seller.id)
  .order("created_at",{ascending:false})
  .order("id");
 if(search){
  const escaped=search.replaceAll("%","\\%").replaceAll("_","\\_");
  query=query.or(`registration.ilike.%${escaped}%,make.ilike.%${escaped}%,model.ilike.%${escaped}%,variant.ilike.%${escaped}%`);
 }
 const {data,error}=await query.range(offset,offset+limit);
 if(error)return mobileJson(request,{ok:false,error:"donors_unavailable"},503);
 const raw=data??[];
 const hasMore=raw.length>limit;
 const page=raw.slice(0,limit);

 return mobileJson(request,{ok:true,items:page.map(item=>({
  id:item.id,
  registration:item.registration,
  make:item.make,
  model:item.model,
  variant:item.variant,
  year:item.year,
  fuelType:item.fuel_type,
  engineSizeSimple:item.engine_size_simple,
  colour:item.colour,
  notes:item.notes,
  createdAt:item.created_at
 })),pagination:{offset,limit,returned:page.length,hasMore}});
}

export async function POST(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;

 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"?payload as Record<string,unknown>:{};
 const make=String(input.make??"").trim().slice(0,80);
 const model=String(input.model??"").trim().slice(0,120);
 const variant=String(input.variant??"").trim().slice(0,160)||null;
 const year=Number(input.year);
 const fuelType=String(input.fuelType??"").trim().slice(0,80)||null;
 const engineRaw=input.engineSizeSimple;
 const engine=engineRaw===undefined||engineRaw===null||engineRaw===""?null:Number(engineRaw);
 const colour=String(input.colour??"").trim().slice(0,80)||null;
 const notes=String(input.notes??"").trim().slice(0,1000)||null;
 const rawRegistration=String(input.registration??"").trim();
 const registration=rawRegistration?normalizeRegistration(rawRegistration):null;

 if(make.length<2||!model||!Number.isInteger(year)||year<1900||year>2100){
  return mobileJson(request,{ok:false,error:"invalid_donor_vehicle"},400);
 }
 if(registration&&!isPlausibleUkRegistration(registration)){
  return mobileJson(request,{ok:false,error:"invalid_registration"},400);
 }
 if(engine!==null&&(!Number.isInteger(engine)||engine<100||engine>10000)){
  return mobileJson(request,{ok:false,error:"invalid_engine"},400);
 }

 const {data,error}=await supabase
  .from("donor_vehicles")
  .insert({
   seller_id:auth.seller.id,
   registration,
   make,
   model,
   variant,
   year,
   fuel_type:fuelType,
   engine_size_simple:engine,
   colour,
   notes
  })
  .select("id")
  .single();
 if(error||!data)return mobileJson(request,{ok:false,error:"donor_save_failed"},503);

 return mobileJson(request,{ok:true,id:data.id},201);
}

export async function DELETE(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const id=new URL(request.url).searchParams.get("id")??"";
 if(!isUuid(id))return mobileJson(request,{ok:false,error:"invalid_donor"},400);

 const {error}=await supabase.from("donor_vehicles").delete().eq("id",id).eq("seller_id",auth.seller.id);
 if(error)return mobileJson(request,{ok:false,error:"donor_delete_failed"},503);
 return mobileJson(request,{ok:true,deleted:true});
}
