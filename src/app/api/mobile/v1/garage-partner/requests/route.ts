import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";
import { schedulePushDispatch } from "@/lib/push/schedule";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 const {data:partner,error:partnerError}=await supabase.from("garage_partners").select("id,status").eq("owner_id",user.id).maybeSingle();
 if(partnerError)return mobileJson(request,{ok:false,error:"garage_partner_unavailable"},503);
 if(!partner)return mobileJson(request,{ok:false,error:"garage_partner_required"},403);
 if(partner.status!=="active")return mobileJson(request,{ok:true,partnerStatus:partner.status,items:[]});
 const {data,error}=await supabase
  .from("fitting_requests")
  .select("id,part_id,vehicle_variant_id,vehicle_year,vehicle_fuel,vehicle_engine_size,vehicle_registration,buyer_notes,status,quote_pence,quote_note,quoted_at,created_at,parts(title,slug),vehicle_catalogue_variants(make,model_family,variant)")
  .eq("garage_partner_id",partner.id)
  .order("created_at",{ascending:false})
  .limit(60);
 if(error)return mobileJson(request,{ok:false,error:"garage_fitting_requests_unavailable"},503);
 const items=(data??[]).flatMap(row=>{
  const part=one(row.parts),vehicle=one(row.vehicle_catalogue_variants);
  if(!part||!vehicle)return [];
  return [{
   id:row.id,partId:row.part_id,partTitle:part.title,partSlug:part.slug,
   vehicleVariantId:row.vehicle_variant_id,vehicleMake:vehicle.make,vehicleModel:vehicle.model_family,vehicleVariant:vehicle.variant,
   vehicleYear:row.vehicle_year,vehicleFuel:row.vehicle_fuel,vehicleEngineSize:row.vehicle_engine_size,
   vehicleRegistration:row.vehicle_registration,buyerNotes:row.buyer_notes,status:row.status,
   quotePence:row.quote_pence,quoteNote:row.quote_note,quotedAt:row.quoted_at,createdAt:row.created_at
  }];
 });
 return mobileJson(request,{ok:true,partnerStatus:partner.status,items});
}

export async function PATCH(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 const {data:partner}=await supabase.from("garage_partners").select("id,status").eq("owner_id",user.id).maybeSingle();
 if(!partner||partner.status!=="active")return mobileJson(request,{ok:false,error:"active_garage_partner_required"},403);
 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload as Record<string,unknown>:{};
 const requestId=String(input.requestId??"");
 const action=String(input.action??"");
 const note=String(input.note??"").trim().slice(0,1000);
 if(!isUuid(requestId)||!["quote","decline","complete"].includes(action))return mobileJson(request,{ok:false,error:"invalid_fitting_action"},400);
 let quotePence:number|undefined;
 if(action==="quote"){
  const raw=Number(input.quotePence);
  if(!Number.isInteger(raw)||raw<0||raw>2000000)return mobileJson(request,{ok:false,error:"invalid_fitting_quote"},400);
  quotePence=raw;
 }
 const {error}=await supabase.rpc("garage_respond_fitting_request",{p_request_id:requestId,p_action:action,p_quote_pence:quotePence,p_note:note||undefined});
 if(error)return mobileJson(request,{ok:false,error:"garage_fitting_update_failed"},409);
 schedulePushDispatch(50);
 return mobileJson(request,{ok:true});
}
