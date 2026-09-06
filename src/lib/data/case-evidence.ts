import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicMemberProfileById } from "@/lib/data/reputation";
import type { TransactionCaseEvidence } from "@/lib/types";

export async function getTransactionCaseEvidence(caseIds:string[]):Promise<Map<string,TransactionCaseEvidence[]>>{
 const result=new Map<string,TransactionCaseEvidence[]>();
 if(!caseIds.length)return result;

 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("transaction_case_evidence")
  .select("id,case_id,uploader_profile_id,storage_path,original_name,mime_type,created_at")
  .in("case_id",caseIds)
  .order("created_at");
 if(error)throw new Error("Case evidence is temporarily unavailable.");

 const rows=data??[];
 const urls=await Promise.all(rows.map(row=>supabase.storage.from("case-evidence").createSignedUrl(row.storage_path,600)));
 const uploaderIds=[...new Set(rows.map(row=>row.uploader_profile_id))];
 const profiles=await Promise.all(uploaderIds.map(id=>getPublicMemberProfileById(id).catch(()=>null)));
 const profileMap=new Map(profiles.filter((profile):profile is NonNullable<typeof profile>=>Boolean(profile)).map(profile=>[profile.id,profile]));

 rows.forEach((row,index)=>{
  const signedUrl=urls[index].data?.signedUrl;
  if(!signedUrl)return;
  const profile=profileMap.get(row.uploader_profile_id);
  const item:TransactionCaseEvidence={
   id:row.id,
   caseId:row.case_id,
   uploaderProfileId:row.uploader_profile_id,
   uploaderHandle:profile?.handle??"member",
   uploaderDisplayName:profile?.displayName??"SecondPart member",
   originalName:row.original_name,
   mimeType:row.mime_type,
   signedUrl,
   createdAt:row.created_at
  };
  result.set(row.case_id,[...(result.get(row.case_id)??[]),item]);
 });
 return result;
}
