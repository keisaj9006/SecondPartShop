import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SupportRequestStatus="open"|"in_progress"|"closed";

export type SupportRequestSummary={
 id:string;
 topic:string;
 message:string;
 status:SupportRequestStatus;
 createdAt:string;
 updatedAt:string;
};

const statuses=new Set<SupportRequestStatus>(["open","in_progress","closed"]);

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
  const status=row.status as SupportRequestStatus;
  if(!statuses.has(status))return [];
  return [{
   id:row.id,
   topic:row.topic,
   message:row.message,
   status,
   createdAt:row.created_at,
   updatedAt:row.updated_at
  }];
 });
}
