"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSellerBusinessKind } from "@/lib/seller-business";
import { normalizePostcode } from "@/lib/postcode";

export type FoundingSellerApplicationState={
 status:"idle"|"success"|"error";
 message?:string;
};

const channels=new Set(["ebay","own_website","physical_counter","facebook","other","none"]);
const importInterests=new Set(["ai_manual","csv","ebay","api","unsure"]);
const clean=(formData:FormData,name:string,max:number)=>String(formData.get(name)??"").trim().slice(0,max);
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const safeWebsite=(value:string)=>{
 if(!value)return null;
 try{
  const url=new URL(value.startsWith("http://")||value.startsWith("https://")?value:"https://"+value);
  return ["http:","https:"].includes(url.protocol)?url.href.slice(0,500):null;
 }catch{return null;}
};

export async function submitFoundingSellerApplication(
 _previous:FoundingSellerApplicationState,
 formData:FormData
):Promise<FoundingSellerApplicationState>{
 // Honeypot: bots often fill every text input. Return a neutral success response.
 if(clean(formData,"companyWebsite",300)){
  return {status:"success",message:"Thanks — your Founding Seller application has been received."};
 }

 const contactName=clean(formData,"contactName",120);
 const email=clean(formData,"email",320).toLowerCase();
 const phone=clean(formData,"phone",80);
 const businessName=clean(formData,"businessName",160);
 const businessKind=clean(formData,"businessKind",40);
 const postcode=normalizePostcode(clean(formData,"postcode",20));
 const websiteRaw=clean(formData,"website",500);
 const websiteUrl=safeWebsite(websiteRaw);
 const estimatedRaw=clean(formData,"estimatedActiveParts",20);
 const estimatedActiveParts=estimatedRaw?Number(estimatedRaw):null;
 const importInterest=clean(formData,"importInterest",40);
 const notes=clean(formData,"notes",2000);
 const sourceRaw=clean(formData,"source",80);
 const inviteToken=clean(formData,"inviteToken",200);
 const selectedChannels=[...new Set(formData.getAll("channels").map(value=>String(value)).filter(value=>channels.has(value)))];

 if(contactName.length<2)return {status:"error",message:"Enter your contact name."};
 if(!validEmail(email))return {status:"error",message:"Enter a valid business email address."};
 if(businessName.length<2)return {status:"error",message:"Enter the business name."};
 if(!isSellerBusinessKind(businessKind))return {status:"error",message:"Choose the closest business type."};
 if(!postcode)return {status:"error",message:"Enter a valid UK postcode."};
 if(websiteRaw&&!websiteUrl)return {status:"error",message:"Enter a valid website URL or leave it blank."};
 if(estimatedActiveParts!==null&&(!Number.isInteger(estimatedActiveParts)||estimatedActiveParts<0||estimatedActiveParts>10000000)){
  return {status:"error",message:"Enter an approximate inventory count as a whole number."};
 }
 if(!importInterests.has(importInterest))return {status:"error",message:"Choose the inventory onboarding method that is closest to your needs."};
 if(formData.get("consent")!=="on")return {status:"error",message:"Confirm that SecondPart may contact you about the Founding Seller Programme."};

 try{
  const supabase=createSupabaseAdminClient();
  let prospectId:string|null=null;
  let validInvite=false;
  if(inviteToken){
   const {data:invite}=await supabase.from("seller_prospect_invites").select("prospect_id,expires_at,used_at").eq("token",inviteToken).maybeSingle();
   if(invite&&!invite.used_at&&new Date(invite.expires_at)>new Date()){
    prospectId=invite.prospect_id;
    validInvite=true;
   }
  }
  const source=validInvite?"outbound_invite":/^[a-zA-Z0-9._-]{1,80}$/.test(sourceRaw)?sourceRaw:"website";
  const {error}=await supabase.from("founding_seller_applications").insert({
   contact_name:contactName,
   email,
   phone:phone||null,
   business_name:businessName,
   business_kind:businessKind,
   postcode,
   website_url:websiteUrl,
   existing_channels:selectedChannels,
   estimated_active_parts:estimatedActiveParts,
   import_interest:importInterest,
   notes:notes||null,
   source,
   prospect_id:prospectId
  });
  if(error&&error.code!=="23505")return {status:"error",message:"We could not submit the application right now. Please try again."};

  let attributed=!error&&Boolean(prospectId);
  if(error?.code==="23505"&&prospectId){
   const {data:existing}=await supabase.from("founding_seller_applications").select("id,prospect_id").eq("email",email).maybeSingle();
   if(existing&&(!existing.prospect_id||existing.prospect_id===prospectId)){
    if(!existing.prospect_id)await supabase.from("founding_seller_applications").update({prospect_id:prospectId,source:"outbound_invite"}).eq("id",existing.id);
    attributed=true;
   }
  }
  if(attributed&&prospectId){
   const followUpAt=new Date(Date.now()+24*60*60*1000).toISOString();
   await Promise.all([
    supabase.from("seller_prospect_invites").update({used_at:new Date().toISOString()}).eq("prospect_id",prospectId).eq("token",inviteToken),
    supabase.from("seller_prospects").update({status:"onboarding",next_action_at:followUpAt}).eq("id",prospectId)
   ]);
  }
  return {
   status:"success",
   message:error?.code==="23505"
    ?"We already have an application for this email address. The Founding Seller team can continue from the existing record."
    :"Thanks — your Founding Seller application has been received."
  };
 }catch{
  return {status:"error",message:"The application service is temporarily unavailable. Please try again."};
 }
}
