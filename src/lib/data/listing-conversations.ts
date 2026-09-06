import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicMemberProfileById } from "@/lib/data/reputation";
import type { ListingConversationSummary,ListingConversationThread } from "@/lib/types";

type ConversationRow={
 id:string;
 part_id:string;
 buyer_id:string;
 status:"open"|"closed";
 last_message_at:string;
 parts:{title:string;slug:string}|Array<{title:string;slug:string}>|null;
 sellers:{business_name:string;owner_id:string|null}|Array<{business_name:string;owner_id:string|null}>|null;
};

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

const mapSummary=(row:ConversationRow):ListingConversationSummary|null=>{
 const part=one(row.parts);
 const seller=one(row.sellers);
 if(!part||!seller)return null;
 return {
  id:row.id,
  partId:row.part_id,
  partTitle:part.title,
  partSlug:part.slug,
  sellerName:seller.business_name,
  buyerId:row.buyer_id,
  sellerOwnerId:seller.owner_id,
  status:row.status,
  lastMessageAt:row.last_message_at
 };
};

export async function getListingConversationsPage(options:{offset?:number;limit?:number;status?:"open"|"closed"|"all"}={}):Promise<{items:ListingConversationSummary[];hasMore:boolean;offset:number;limit:number}>{
 const offset=Math.max(0,Math.floor(options.offset??0));
 const limit=Math.max(1,Math.min(Math.floor(options.limit??30),60));
 const supabase=await createSupabaseServerClient();
 let query=supabase
  .from("listing_conversations")
  .select("id,part_id,buyer_id,status,last_message_at,parts(title,slug),sellers(business_name,owner_id)")
  .order("last_message_at",{ascending:false})
  .order("id");
 if(options.status&&options.status!=="all")query=query.eq("status",options.status);
 const {data,error}=await query.range(offset,offset+limit);
 if(error)throw new Error("Pre-purchase messages are temporarily unavailable.");
 const raw=data??[];
 const hasMore=raw.length>limit;
 const items=raw.slice(0,limit).flatMap(row=>{
  const mapped=mapSummary(row as unknown as ConversationRow);
  return mapped?[mapped]:[];
 });
 return {items,hasMore,offset,limit};
}

export async function getListingConversations():Promise<ListingConversationSummary[]>{
 return (await getListingConversationsPage({limit:60})).items;
}

export async function getListingConversation(conversationId:string,options:{offset?:number;limit?:number}={}):Promise<ListingConversationThread|null>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("listing_conversations")
  .select("id,part_id,buyer_id,status,last_message_at,parts(title,slug),sellers(business_name,owner_id)")
  .eq("id",conversationId)
  .maybeSingle();
 if(error||!data)return null;

 const summary=mapSummary(data as unknown as ConversationRow);
 if(!summary)return null;

 const offset=Math.max(0,Math.floor(options.offset??0));
 const limit=Math.max(1,Math.min(Math.floor(options.limit??100),200));
 const {data:messageRows,error:messageError}=await supabase
  .from("listing_conversation_messages")
  .select("id,sender_profile_id,body,created_at")
  .eq("conversation_id",conversationId)
  .order("created_at",{ascending:false})
  .order("id",{ascending:false})
  .range(offset,offset+limit);
 const rawMessages=messageRows??[];
 const hasOlder=rawMessages.length>limit;
 const messages=rawMessages.slice(0,limit).reverse();
 if(messageError)throw new Error("Conversation messages are temporarily unavailable.");

 const ids=[...new Set(messages.map(message=>message.sender_profile_id))];
 const profiles=await Promise.all(ids.map(id=>getPublicMemberProfileById(id).catch(()=>null)));
 const byId=new Map(profiles.filter((p):p is NonNullable<typeof p>=>Boolean(p)).map(p=>[p.id,p]));

 return {
  ...summary,
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
  messagePagination:{offset,limit,hasOlder,hasNewer:offset>0}
 };
}
