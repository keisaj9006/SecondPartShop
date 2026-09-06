import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request,{params}:{params:Promise<{orderItemId:string}>}){
 const {orderItemId}=await params;
 if(!isUuid(orderItemId))return mobileJson(request,{ok:false,error:"invalid_order_item"},400);

 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??100);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,200)):100;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;

 const {data:item,error:itemError}=await supabase
  .from("order_items")
  .select("id,parts(title,slug),sellers(business_name,owner_id),orders(buyer_id,payment_status)")
  .eq("id",orderItemId)
  .maybeSingle();
 if(itemError)return mobileJson(request,{ok:false,error:"transaction_unavailable"},503);
 if(!item)return mobileJson(request,{ok:false,error:"not_found"},404);

 const part=one(item.parts);
 const seller=one(item.sellers);
 const order=one(item.orders);
 if(!part||!seller||!order)return mobileJson(request,{ok:false,error:"transaction_unavailable"},503);

 const {data:messageRows,error:messageError}=await supabase
  .from("transaction_messages")
  .select("id,sender_profile_id,body,created_at")
  .eq("order_item_id",orderItemId)
  .order("created_at",{ascending:false})
  .order("id",{ascending:false})
  .range(offset,offset+limit);
 if(messageError)return mobileJson(request,{ok:false,error:"messages_unavailable"},503);
 const rawMessages=messageRows??[];
 const hasOlder=rawMessages.length>limit;
 const messages=rawMessages.slice(0,limit).reverse();

 const senderIds=[...new Set(messages.map(message=>message.sender_profile_id))];
 const profiles=await Promise.all(senderIds.map(async id=>{
  const {data}=await supabase.rpc("get_public_member_profile_by_id",{p_profile_id:id});
  const profile=data?.[0];
  return profile?{id,handle:profile.handle,displayName:profile.display_name}:null;
 }));
 const byId=new Map(profiles.filter((profile):profile is NonNullable<typeof profile>=>Boolean(profile)).map(profile=>[profile.id,profile]));

 return mobileJson(request,{
  ok:true,
  thread:{
   orderItemId:item.id,
   partTitle:part.title,
   partSlug:part.slug,
   sellerName:seller.business_name,
   buyerId:order.buyer_id,
   sellerOwnerId:seller.owner_id,
   paymentStatus:order.payment_status,
   messages:messages.map(message=>{
    const profile=byId.get(message.sender_profile_id);
    return {
     id:message.id,
     senderProfileId:message.sender_profile_id,
     senderHandle:profile?.handle??"member",
     senderDisplayName:profile?.displayName??"SecondPart member",
     body:message.body,
     createdAt:message.created_at
    };
   }),
   pagination:{offset,limit,returned:messages.length,hasOlder,hasNewer:offset>0}
  }
 });
}

export async function POST(request:Request,{params}:{params:Promise<{orderItemId:string}>}){
 const {orderItemId}=await params;
 if(!isUuid(orderItemId))return mobileJson(request,{ok:false,error:"invalid_order_item"},400);

 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;

 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const body=payload&&typeof payload==="object"&&"body" in payload?String((payload as {body?:unknown}).body??"").trim():"";
 if(!body)return mobileJson(request,{ok:false,error:"message_required"},400);
 if(body.length>2000)return mobileJson(request,{ok:false,error:"message_too_long"},400);

 const {data,error}=await supabase.rpc("send_transaction_message",{
  p_order_item_id:orderItemId,
  p_body:body
 });
 if(error){
  const lower=error.message.toLowerCase();
  if(lower.includes("after payment"))return mobileJson(request,{ok:false,error:"payment_required"},409);
  if(lower.includes("participant"))return mobileJson(request,{ok:false,error:"forbidden"},403);
  return mobileJson(request,{ok:false,error:"message_failed"},409);
 }

 return mobileJson(request,{ok:true,messageId:data},201);
}
