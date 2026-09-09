import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicMemberProfileById } from "@/lib/data/reputation";
import type { TransactionThread } from "@/lib/types";

type ThreadRow={
 id:string;
 parts:{title:string;slug:string}|Array<{title:string;slug:string}>|null;
 sellers:{business_name:string;owner_id:string|null}|Array<{business_name:string;owner_id:string|null}>|null;
 orders:{buyer_id:string|null;payment_status:string}|Array<{buyer_id:string|null;payment_status:string}>|null;
};

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function getTransactionThread(orderItemId:string,options:{offset?:number;limit?:number}={}):Promise<TransactionThread|null>{
 const supabase=await createSupabaseServerClient();
 const {data:item,error:itemError}=await supabase
  .from("order_items")
  .select("id,parts(title,slug),sellers(business_name,owner_id),orders(buyer_id,payment_status)")
  .eq("id",orderItemId)
  .maybeSingle();
 if(itemError||!item)return null;

 const raw=item as unknown as ThreadRow;
 const part=one(raw.parts);
 const seller=one(raw.sellers);
 const order=one(raw.orders);
 if(!part||!seller||!order)return null;

 const offset=Math.max(0,Math.floor(options.offset??0));
 const limit=Math.max(1,Math.min(Math.floor(options.limit??100),200));
 const {data:messageRows,error:messageError}=await supabase
  .from("transaction_messages")
  .select("id,sender_profile_id,body,created_at")
  .eq("order_item_id",orderItemId)
  .order("created_at",{ascending:false})
  .order("id",{ascending:false})
  .range(offset,offset+limit);
 const rawMessages=messageRows??[];
 const hasOlder=rawMessages.length>limit;
 const messages=rawMessages.slice(0,limit).reverse();
 if(messageError)throw new Error("Transaction messages are temporarily unavailable.");

 const senderIds=[...new Set(messages.map(message=>message.sender_profile_id).filter((id):id is string=>Boolean(id)))];
 const senderProfiles=await Promise.all(senderIds.map(id=>getPublicMemberProfileById(id).catch(()=>null)));
 const profiles=new Map(senderProfiles.filter((profile):profile is NonNullable<typeof profile>=>Boolean(profile)).map(profile=>[profile.id,profile]));

 return {
  orderItemId:raw.id,
  partTitle:part.title,
  partSlug:part.slug,
  sellerName:seller.business_name,
  buyerId:order.buyer_id,
  sellerOwnerId:seller.owner_id,
  paymentStatus:order.payment_status,
  messages:messages.map(message=>{
   const profile=message.sender_profile_id?profiles.get(message.sender_profile_id):undefined;
   return {
    id:message.id,
    senderProfileId:message.sender_profile_id,
    senderHandle:profile?.handle??(message.sender_profile_id?"member":"deleted-member"),
    senderDisplayName:profile?.displayName??(message.sender_profile_id?"SecondPart member":"Deleted member"),
    body:message.body,
    createdAt:message.created_at
   };
  }),
  messagePagination:{offset,limit,hasOlder,hasNewer:offset>0}
 };
}
