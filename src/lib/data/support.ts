import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SupportRequestStatus="open"|"in_progress"|"resolved"|"closed";
export type SupportRequestSenderRole="user"|"admin";

export type SupportRequestSummary={
 id:string;
 topic:string;
 message:string;
 status:SupportRequestStatus;
 createdAt:string;
 updatedAt:string;
};

export type SupportRequestMessage={
 id:string;
 senderProfileId:string|null;
 senderRole:SupportRequestSenderRole;
 message:string;
 createdAt:string;
};

export type SupportRequestConversation={
 request:SupportRequestSummary;
 messages:SupportRequestMessage[];
};

const statuses=new Set<SupportRequestStatus>(["open","in_progress","resolved","closed"]);
const senderRoles=new Set<SupportRequestSenderRole>(["user","admin"]);

const mapRequest=(row:{id:string;topic:string;message:string;status:string;created_at:string;updated_at:string}):SupportRequestSummary|null=>{
 const status=row.status as SupportRequestStatus;
 if(!statuses.has(status))return null;
 return {id:row.id,topic:row.topic,message:row.message,status,createdAt:row.created_at,updatedAt:row.updated_at};
};

export async function getSupportRequestsForUser(userId:string):Promise<SupportRequestSummary[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("support_requests")
  .select("id,topic,message,status,created_at,updated_at")
  .eq("profile_id",userId)
  .order("created_at",{ascending:false})
  .limit(10);
 if(error)throw new Error("Support request history is temporarily unavailable.");
 return (data??[]).flatMap(row=>{
  const request=mapRequest(row);
  return request?[request]:[];
 });
}

export async function getSupportRequestConversationForUser(userId:string,requestId:string):Promise<SupportRequestConversation|null>{
 const supabase=await createSupabaseServerClient();
 const {data:requestRow,error:requestError}=await supabase
  .from("support_requests")
  .select("id,topic,message,status,created_at,updated_at")
  .eq("id",requestId)
  .eq("profile_id",userId)
  .maybeSingle();
 if(requestError)throw new Error("Support conversation is temporarily unavailable.");
 if(!requestRow)return null;
 const request=mapRequest(requestRow);
 if(!request)return null;

 const {data:messageRows,error:messageError}=await supabase
  .from("support_request_messages")
  .select("id,sender_profile_id,sender_role,message,created_at")
  .eq("support_request_id",requestId)
  .order("created_at",{ascending:true})
  .limit(100);
 if(messageError)throw new Error("Support conversation is temporarily unavailable.");

 const messages=(messageRows??[]).flatMap(row=>{
  const senderRole=row.sender_role as SupportRequestSenderRole;
  if(!senderRoles.has(senderRole))return [];
  return [{
   id:row.id,
   senderProfileId:row.sender_profile_id,
   senderRole,
   message:row.message,
   createdAt:row.created_at
  }];
 });
 return {request,messages};
}