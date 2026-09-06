"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const handlePattern=/^[a-z0-9][a-z0-9-]{2,31}$/;

export async function updateMemberProfile(_previous:ActionState,formData:FormData):Promise<ActionState>{
  const user=await requireUser("/account/profile");
  const displayName=String(formData.get("displayName")??"").trim();
  const handle=String(formData.get("handle")??"").trim().toLowerCase();
  const bio=String(formData.get("bio")??"").trim();
  const phone=String(formData.get("phone")??"").trim();

  if(displayName.length<2||displayName.length>100)return {status:"error",message:"Display name must be between 2 and 100 characters."};
  if(!handlePattern.test(handle))return {status:"error",message:"Username must be 3–32 characters using lowercase letters, numbers and hyphens only."};
  if(bio.length>500)return {status:"error",message:"Bio must be 500 characters or fewer."};
  if(phone.length>50)return {status:"error",message:"Phone number is too long."};

  const supabase=await createSupabaseServerClient();
  const {data:existing,error:lookupError}=await supabase
    .from("profiles")
    .select("id")
    .eq("handle",handle)
    .neq("id",user.id)
    .maybeSingle();

  if(lookupError)return {status:"error",message:"We could not check that username right now."};
  if(existing)return {status:"error",message:"That username is already taken."};

  const {error}=await supabase
    .from("profiles")
    .update({
      display_name:displayName,
      handle,
      bio:bio||null,
      phone:phone||null
    })
    .eq("id",user.id);

  if(error)return {status:"error",message:"We could not save your profile right now."};

  revalidatePath("/account");
  revalidatePath("/account/profile");
  revalidatePath(`/member/${handle}`);
  return {status:"success",message:"Profile saved."};
}
