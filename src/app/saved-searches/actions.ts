"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const allowed=new Set(["q","category","condition","sort","min","max","pc","collection","vehicle","vr","cv","cy","cf","ce"]);

const safeParams=(raw:string)=>{
 let parsed:unknown;
 try{parsed=JSON.parse(raw);}catch{return null;}
 if(typeof parsed!=="object"||parsed===null||Array.isArray(parsed))return null;
 const result:Record<string,string>={};
 for(const [key,value] of Object.entries(parsed as Record<string,unknown>)){
  if(allowed.has(key)&&typeof value==="string"&&value.length<=200)result[key]=value;
 }
 return result;
};

export async function createSavedSearch(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const user=await requireUser("/saved-searches");
 const name=String(formData.get("name")??"").trim().slice(0,80);
 const params=safeParams(String(formData.get("searchParams")??"{}"));
 if(name.length<2)return {status:"error",message:"Give this search a short name."};
 if(!params||!Object.keys(params).length)return {status:"error",message:"Choose a part, category, vehicle or filter before saving a search."};
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.from("saved_searches").insert({profile_id:user.id,name,search_params:params});
 if(error)return {status:"error",message:error.message};
 revalidatePath("/saved-searches");
 revalidatePath("/account");
 return {status:"success",message:"Search saved."};
}

export async function deleteSavedSearch(formData:FormData){
 const user=await requireUser("/saved-searches");
 const id=String(formData.get("id")??"");
 if(!id)return;
 const supabase=await createSupabaseServerClient();
 await supabase.from("saved_searches").delete().eq("id",id).eq("profile_id",user.id);
 revalidatePath("/saved-searches");
 revalidatePath("/account");
}
