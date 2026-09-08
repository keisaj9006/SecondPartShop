"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseCsv } from "@/lib/csv";
import { normalizePostcode } from "@/lib/postcode";
import { isUuid } from "@/lib/identifiers";

export type ProspectImportIssue={row:number;message:string};
export type ProspectImportState={
 status:"idle"|"preview"|"success"|"error";
 message?:string;
 rowsReceived?:number;
 validRows?:number;
 rejectedRows?:number;
 issues?:ProspectImportIssue[];
 sample?:Array<{row:number;businessName:string;businessKind:string;postcode:string;sourceType:string}>;
};

const kinds=new Set(["breaker","atf","garage","parts_business","ebay_seller","other"]);
const sources=new Set(["vra","regulator","ebay","website","manual","other"]);
const priorities=new Set(["A","B","C"]);
const statuses=new Set(["research","ready","contacted","replied","qualified","invited","onboarding","onboarded","not_interested","do_not_contact"]);
const MAX_ROWS=5000;
const MAX_BYTES=8*1024*1024;
const clean=(value:string|undefined,max=500)=>value?.trim().slice(0,max)??"";
const safeUrl=(value:string)=>{
 if(!value)return null;
 try{
  const url=new URL(value.startsWith("http://")||value.startsWith("https://")?value:"https://"+value);
  return ["http:","https:"].includes(url.protocol)?url.href.slice(0,500):null;
 }catch{return null;}
};
const validEmail=(value:string)=>!value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const slug=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,140);
const chunks=<T,>(items:T[],size:number)=>{const out:T[][]=[];for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));return out;};

type ProspectRow={
 dedupe_key:string;
 business_name:string;
 business_kind:string;
 website_url:string|null;
 public_email:string|null;
 public_phone:string|null;
 location:string|null;
 postcode:string|null;
 source_type:string;
 source_url:string|null;
 estimated_inventory:number|null;
 priority:string;
 notes:string|null;
};

async function validateProspects(file:File){
 if(!file.size)return {fatal:"Choose a CSV file.",received:0,rows:[] as ProspectRow[],issues:[] as ProspectImportIssue[],sample:[] as ProspectImportState["sample"]};
 if(file.size>MAX_BYTES)return {fatal:"CSV files can be up to 8 MB.",received:0,rows:[] as ProspectRow[],issues:[] as ProspectImportIssue[],sample:[] as ProspectImportState["sample"]};
 if(!file.name.toLowerCase().endsWith(".csv"))return {fatal:"Choose a .csv file.",received:0,rows:[] as ProspectRow[],issues:[] as ProspectImportIssue[],sample:[] as ProspectImportState["sample"]};
 const parsed=parseCsv(await file.text());
 if(parsed.error)return {fatal:parsed.error,received:0,rows:[] as ProspectRow[],issues:[] as ProspectImportIssue[],sample:[] as ProspectImportState["sample"]};
 if(!parsed.headers.includes("business_name")||!parsed.headers.includes("business_kind"))return {fatal:"CSV requires business_name and business_kind columns.",received:parsed.rows.length,rows:[] as ProspectRow[],issues:[] as ProspectImportIssue[],sample:[] as ProspectImportState["sample"]};
 if(parsed.rows.length>MAX_ROWS)return {fatal:"Import up to "+MAX_ROWS+" prospects per CSV.",received:parsed.rows.length,rows:[] as ProspectRow[],issues:[] as ProspectImportIssue[],sample:[] as ProspectImportState["sample"]};

 const issues:ProspectImportIssue[]=[];
 const rows:ProspectRow[]=[];
 const sample:NonNullable<ProspectImportState["sample"]>=[];
 const seen=new Set<string>();

 for(let index=0;index<parsed.rows.length;index+=1){
  const source=parsed.rows[index];
  const row=index+2;
  const rowIssues:string[]=[];
  const businessName=clean(source.business_name,180);
  const businessKind=clean(source.business_kind,40).toLowerCase();
  const websiteRaw=clean(source.website_url,500);
  const websiteUrl=safeUrl(websiteRaw);
  const email=clean(source.public_email,320).toLowerCase();
  const phone=clean(source.public_phone,80);
  const location=clean(source.location,120);
  const postcodeRaw=clean(source.postcode,20);
  const postcode=postcodeRaw?normalizePostcode(postcodeRaw):null;
  const sourceType=(clean(source.source_type,40)||"manual").toLowerCase();
  const sourceUrlRaw=clean(source.source_url,500);
  const sourceUrl=safeUrl(sourceUrlRaw);
  const estimatedRaw=clean(source.estimated_inventory,20);
  const estimated=estimatedRaw?Number(estimatedRaw):null;
  const priority=(clean(source.priority,2)||"B").toUpperCase();
  const notes=clean(source.notes,2000);
  const key=postcode?slug(businessName)+"|"+postcode.replace(/\s+/g,"").toLowerCase():websiteUrl?slug(businessName)+"|"+new URL(websiteUrl).hostname.replace(/^www\./,"").toLowerCase():email?slug(businessName)+"|"+email:slug(businessName)+"|"+slug(location);

  if(businessName.length<2)rowIssues.push("business_name is required.");
  if(!kinds.has(businessKind))rowIssues.push("business_kind must be breaker, atf, garage, parts_business, ebay_seller or other.");
  if(websiteRaw&&!websiteUrl)rowIssues.push("website_url is not a valid HTTP/HTTPS URL.");
  if(!validEmail(email))rowIssues.push("public_email is not a valid email address.");
  if(postcodeRaw&&!postcode)rowIssues.push("postcode is not valid.");
  if(!sources.has(sourceType))rowIssues.push("source_type must be vra, regulator, ebay, website, manual or other.");
  if(sourceUrlRaw&&!sourceUrl)rowIssues.push("source_url is not a valid HTTP/HTTPS URL.");
  if(estimated!==null&&(!Number.isInteger(estimated)||estimated<0||estimated>10000000))rowIssues.push("estimated_inventory must be a whole number between 0 and 10,000,000.");
  if(!priorities.has(priority))rowIssues.push("priority must be A, B or C.");
  if(!key.replaceAll("|",""))rowIssues.push("Not enough information to create a dedupe key.");
  if(seen.has(key))rowIssues.push("Duplicate prospect inside this CSV.");
  seen.add(key);

  sample.push({row,businessName:businessName||"(missing)",businessKind:businessKind||"(missing)",postcode:postcode??"",sourceType});
  if(rowIssues.length){for(const message of rowIssues)issues.push({row,message});continue;}
  rows.push({
   dedupe_key:key,business_name:businessName,business_kind:businessKind,website_url:websiteUrl,public_email:email||null,public_phone:phone||null,
   location:location||null,postcode,source_type:sourceType,source_url:sourceUrl,estimated_inventory:estimated,priority,notes:notes||null
  });
 }
 return {fatal:null,received:parsed.rows.length,rows,issues,sample:sample.slice(0,8)};
}

export async function importSellerProspects(_previous:ProspectImportState,formData:FormData):Promise<ProspectImportState>{
 await requireAdmin("/admin/seller-prospects");
 const file=formData.get("file");
 if(!(file instanceof File))return {status:"error",message:"Choose a CSV file."};
 const validation=await validateProspects(file);
 if(validation.fatal)return {status:"error",message:validation.fatal,rowsReceived:validation.received};
 const supabase=await createSupabaseServerClient();
 const keys=validation.rows.map(row=>row.dedupe_key);
 const existing=new Set<string>();
 for(const part of chunks(keys,250)){
  const {data,error}=await supabase.from("seller_prospects").select("dedupe_key").in("dedupe_key",part);
  if(error)return {status:"error",message:"Existing prospects could not be checked."};
  for(const row of data??[])existing.add(row.dedupe_key);
 }
 const newRows=validation.rows.filter(row=>!existing.has(row.dedupe_key));
 const duplicateIssues=validation.rows.filter(row=>existing.has(row.dedupe_key)).map(row=>({row:0,message:"Existing prospect skipped: "+row.business_name}));
 const rejected=validation.received-newRows.length;
 const issues=[...validation.issues,...duplicateIssues];
 const mode=String(formData.get("mode")??"preview");
 if(mode!=="import")return {status:"preview",message:newRows.length+" new prospect"+(newRows.length===1?"":"s")+" ready to import. "+rejected+" row"+(rejected===1?"":"s")+" rejected or already present.",rowsReceived:validation.received,validRows:newRows.length,rejectedRows:rejected,issues:issues.slice(0,80),sample:validation.sample};
 if(!newRows.length)return {status:"error",message:"There are no new valid prospects to import.",rowsReceived:validation.received,validRows:0,rejectedRows:rejected,issues:issues.slice(0,80),sample:validation.sample};

 let created=0;
 for(const part of chunks(newRows,200)){
  const {data,error}=await supabase.from("seller_prospects").upsert(part,{onConflict:"dedupe_key",ignoreDuplicates:true}).select("id");
  if(error)return {status:"error",message:"Prospect import stopped because the database rejected a batch.",rowsReceived:validation.received,validRows:created,rejectedRows:validation.received-created,issues:issues.slice(0,80),sample:validation.sample};
  created+=(data??[]).length;
 }
 revalidatePath("/admin/seller-prospects");
 return {status:"success",message:created+" prospect"+(created===1?"":"s")+" imported into the outbound CRM.",rowsReceived:validation.received,validRows:created,rejectedRows:validation.received-created,issues:issues.slice(0,80),sample:validation.sample};
}

export async function updateSellerProspect(formData:FormData){
 await requireAdmin("/admin/seller-prospects");
 const id=String(formData.get("id")??"");
 const status=String(formData.get("status")??"");
 const priority=String(formData.get("priority")??"").toUpperCase();
 const notes=String(formData.get("notes")??"").trim().slice(0,2000);
 const nextRaw=String(formData.get("nextActionAt")??"").trim();
 if(!isUuid(id)||!statuses.has(status)||!priorities.has(priority))return;
 let nextActionAt:string|null=null;
 if(nextRaw){
  const parsed=new Date(nextRaw);
  if(Number.isNaN(parsed.getTime()))return;
  nextActionAt=parsed.toISOString();
 }
 if(["onboarded","not_interested","do_not_contact"].includes(status))nextActionAt=null;
 const supabase=await createSupabaseServerClient();
 const values={
  status,
  priority,
  notes:notes||null,
  next_action_at:nextActionAt,
  ...(status==="contacted"?{last_contacted_at:new Date().toISOString()}:{})
 };
 const {error}=await supabase.from("seller_prospects").update(values).eq("id",id);
 if(error)throw error;
 revalidatePath("/admin/seller-prospects");
}


const activityTypes=new Set(["research","email","call","reply","meeting","invite","note"]);

export async function addSellerProspectActivity(formData:FormData){
 const {profile}=await requireAdmin("/admin/seller-prospects");
 const prospectId=String(formData.get("prospectId")??"");
 const activityType=String(formData.get("activityType")??"");
 const outcome=String(formData.get("outcome")??"").trim().slice(0,500);
 const note=String(formData.get("activityNote")??"").trim().slice(0,2000);
 const nextRaw=String(formData.get("activityNextActionAt")??"").trim();
 if(!isUuid(prospectId)||!activityTypes.has(activityType))return;

 let nextActionAt:string|null=null;
 if(nextRaw){
  const parsed=new Date(nextRaw);
  if(Number.isNaN(parsed.getTime()))return;
  nextActionAt=parsed.toISOString();
 }

 const supabase=await createSupabaseServerClient();
 const {data:prospect,error:prospectError}=await supabase
  .from("seller_prospects")
  .select("id,status")
  .eq("id",prospectId)
  .maybeSingle();
 if(prospectError||!prospect)return;

 const {error:activityError}=await supabase.from("seller_prospect_activities").insert({
  prospect_id:prospectId,
  actor_profile_id:profile.id,
  activity_type:activityType,
  outcome:outcome||null,
  note:note||null,
  next_action_at:nextActionAt
 });
 if(activityError)throw activityError;

 const currentStatus=prospect.status;
 let nextStatus=currentStatus;
 if(["email","call"].includes(activityType)&&["research","ready"].includes(currentStatus))nextStatus="contacted";
 if(activityType==="reply"&&["research","ready","contacted"].includes(currentStatus))nextStatus="replied";
 if(activityType==="invite"&&!["onboarded","not_interested","do_not_contact"].includes(currentStatus))nextStatus="invited";

 const values:{
  status:string;
  next_action_at:string|null;
  last_contacted_at?:string;
 }={
  status:nextStatus,
  next_action_at:nextActionAt
 };
 if(["email","call","meeting","invite"].includes(activityType))values.last_contacted_at=new Date().toISOString();

 const {error:updateError}=await supabase.from("seller_prospects").update(values).eq("id",prospectId);
 if(updateError)throw updateError;
 revalidatePath("/admin/seller-prospects");
}


export async function createSellerProspectInvite(formData:FormData){
 const {profile}=await requireAdmin("/admin/seller-prospects");
 const prospectId=String(formData.get("prospectId")??"");
 if(!isUuid(prospectId))return;
 const supabase=await createSupabaseServerClient();
 const {data:prospect,error:prospectError}=await supabase.from("seller_prospects")
  .select("id,status")
  .eq("id",prospectId)
  .maybeSingle();
 if(prospectError||!prospect||["onboarded","not_interested","do_not_contact"].includes(prospect.status))return;

 const token=crypto.randomUUID()+"-"+crypto.randomUUID();
 const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
 const followUpAt=new Date(Date.now()+3*24*60*60*1000).toISOString();
 const {error:inviteError}=await supabase.from("seller_prospect_invites").upsert({
  prospect_id:prospectId,
  token,
  created_by:profile.id,
  expires_at:expiresAt,
  used_at:null
 },{onConflict:"prospect_id"});
 if(inviteError)throw inviteError;

 const {error:activityError}=await supabase.from("seller_prospect_activities").insert({
  prospect_id:prospectId,
  actor_profile_id:profile.id,
  activity_type:"invite",
  outcome:"Founding Seller invite link created",
  note:"Unique 30-day Founding Seller application link generated.",
  next_action_at:followUpAt
 });
 if(activityError)throw activityError;

 const {error:updateError}=await supabase.from("seller_prospects").update({
  status:"invited",
  last_contacted_at:new Date().toISOString(),
  next_action_at:followUpAt
 }).eq("id",prospectId);
 if(updateError)throw updateError;
 revalidatePath("/admin/seller-prospects");
}
