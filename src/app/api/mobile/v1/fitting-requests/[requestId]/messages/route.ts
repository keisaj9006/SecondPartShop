import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";
import { schedulePushDispatch } from "@/lib/push/schedule";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T,>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request,{params}:{params:Promise<{requestId:string}>}){
 const {requestId}=await params;
 if(!isUuid(requestId))return mobileJson(request,{ok:false,error:"invalid_fitting_request"},400);
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 const {data,error}=await supabase
  .from("fitting_requests")
  .select("id,buyer_id,status,quote_pence,quote_note,buyer_notes,vehicle_year,vehicle_fuel,vehicle_engine_size,vehicle_registration,parts(title,slug),garage_partners(owner_id,business_name,location),vehicle_catalogue_variants(make,model_family,variant)")
  .eq("id",requestId)
  .maybeSingle();
 if(error)return mobileJson(request,{ok:false,error:"fitting_chat_unavailable"},503);
 if(!data)return mobileJson(request,{ok:false,error:"fitting_request_not_found"},404);

 const part=one(data.parts),garage=one(data.garage_partners),vehicle=one(data.vehicle_catalogue_variants);
 if(!part||!garage||!vehicle)return mobileJson(request,{ok:false,error:"fitting_request_unavailable"},503);
 const viewerRole=data.buyer_id===user.id?"buyer":garage.owner_id===user.id?"garage":"other";
 if(viewerRole==="other")return mobileJson(request,{ok:false,error:"fitting_request_not_found"},404);

 const {data:messages,error:messagesError}=await supabase
  .from("fitting_request_messages")
  .select("id,sender_profile_id,body,created_at")
  .eq("fitting_request_id",requestId)
  .order("created_at")
  .order("id")
  .limit(300);
 if(messagesError)return mobileJson(request,{ok:false,error:"fitting_chat_unavailable"},503);

 return mobileJson(request,{
  ok:true,
  request:{
   id:data.id,status:data.status,quotePence:data.quote_pence,quoteNote:data.quote_note,buyerNotes:data.buyer_notes,
   partTitle:part.title,partSlug:part.slug,garageName:garage.business_name,garageLocation:garage.location,
   vehicleMake:vehicle.make,vehicleModel:vehicle.model_family,vehicleVariant:vehicle.variant,
   vehicleYear:data.vehicle_year,vehicleFuel:data.vehicle_fuel,vehicleEngineSize:data.vehicle_engine_size,
   vehicleRegistration:data.vehicle_registration,viewerRole
  },
  messages:(messages??[]).map(message=>({
   id:message.id,senderProfileId:message.sender_profile_id,body:message.body,createdAt:message.created_at,mine:message.sender_profile_id===user.id
  })),
  canMessage:data.status==="accepted"
 });
}

export async function POST(request:Request,{params}:{params:Promise<{requestId:string}>}){
 const {requestId}=await params;
 if(!isUuid(requestId))return mobileJson(request,{ok:false,error:"invalid_fitting_request"},400);
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload as Record<string,unknown>:{};
 const body=String(input.body??"").trim().slice(0,2000);
 if(!body)return mobileJson(request,{ok:false,error:"message_required"},400);
 const {data,error}=await auth.context.supabase.rpc("send_fitting_request_message",{p_request_id:requestId,p_body:body});
 if(error){
  const message=error.message.toLowerCase();
  if(message.includes("after the fitting quote is accepted"))return mobileJson(request,{ok:false,error:"fitting_chat_not_open"},409);
  return mobileJson(request,{ok:false,error:"fitting_message_failed"},409);
 }
 schedulePushDispatch(50);
 return mobileJson(request,{ok:true,id:data},201);
}
