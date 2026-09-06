import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";
import { isUuid } from "@/lib/identifiers";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request,{params}:{params:Promise<{conversationId:string}>}){
 const {conversationId}=await params;
 if(!isUuid(conversationId))return mobileJson(request,{ok:false,error:"invalid_conversation"},400);

 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;

 const {data,error}=await supabase
  .from("listing_conversations")
  .select("id,part_id,buyer_id,status,last_message_at,parts(title,slug),sellers(business_name,owner_id)")
  .eq("id",conversationId)
  .maybeSingle();
 if(error)return mobileJson(request,{ok:false,error:"conversation_unavailable"},503);
 if(!data)return mobileJson(request,{ok:false,error:"not_found"},404);

 const part=one(data.parts);
 const seller=one(data.sellers);
 if(!part||!seller)return mobileJson(request,{ok:false,error:"conversation_unavailable"},503);

 const {data:messages,error:messageError}=await supabase
  .from("listing_conversation_messages")
  .select("id,sender_profile_id,body,created_at")
  .eq("conversation_id",conversationId)
  .order("created_at",{ascending:true});
 if(messageError)return mobileJson(request,{ok:false,error:"messages_unavailable"},503);

 const senderIds=[...new Set((messages??[]).map(message=>message.sender_profile_id))];
 const {data:profiles}=senderIds.length
  ?await supabase.from("profiles").select("id,handle,display_name").in("id",senderIds)
  :{data:[] as Array<{id:string;handle:string;display_name:string}>};
 const byId=new Map((profiles??[]).map(profile=>[profile.id,profile]));

 return mobileJson(request,{
  ok:true,
  conversation:{
   id:data.id,
   partId:data.part_id,
   partTitle:part.title,
   partSlug:part.slug,
   sellerName:seller.business_name,
   buyerId:data.buyer_id,
   sellerOwnerId:seller.owner_id,
   status:data.status,
   lastMessageAt:data.last_message_at,
   messages:(messages??[]).map(message=>{
    const profile=byId.get(message.sender_profile_id);
    return {
     id:message.id,
     senderProfileId:message.sender_profile_id,
     senderHandle:profile?.handle??"member",
     senderDisplayName:profile?.display_name??"SecondPart member",
     body:message.body,
     createdAt:message.created_at
    };
   })
  }
 });
}

export async function POST(request:Request,{params}:{params:Promise<{conversationId:string}>}){
 const {conversationId}=await params;
 if(!isUuid(conversationId))return mobileJson(request,{ok:false,error:"invalid_conversation"},400);

 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;

 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const message=typeof body==="object"&&body!==null&&"body" in body?String((body as {body?:unknown}).body??"").trim():"";
 if(!message)return mobileJson(request,{ok:false,error:"message_required"},400);
 if(message.length>2000)return mobileJson(request,{ok:false,error:"message_too_long"},400);

 const {data,error}=await supabase.rpc("send_listing_conversation_message",{
  p_conversation_id:conversationId,
  p_body:message
 });
 if(error){
  const lower=error.message.toLowerCase();
  if(lower.includes("rate limit"))return mobileJson(request,{ok:false,error:"rate_limited"},429);
  if(lower.includes("participant"))return mobileJson(request,{ok:false,error:"forbidden"},403);
  return mobileJson(request,{ok:false,error:"message_failed"},400);
 }

 return mobileJson(request,{ok:true,messageId:data},201);
}
