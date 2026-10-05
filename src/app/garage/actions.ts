"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { saveGarageVehicleForUser,type GarageSaveResult } from "@/lib/garage-save";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const text=(value:FormDataEntryValue|null)=>String(value??"").trim();

export async function saveGarageVehicle(formData:FormData):Promise<GarageSaveResult>{
 await requireUser("/");
 const supabase=await createSupabaseServerClient();
 const incomingHeaders=await headers();
 const result=await saveGarageVehicleForUser(supabase,new Request("https://secondpart.invalid/garage",{headers:incomingHeaders}),Object.fromEntries(formData));
 if(result.ok){revalidatePath("/");revalidatePath("/garage");revalidatePath("/account");}
 return result;
}

/** Legacy catalogue forms use React's void contract; new UI consumes the result. */
export async function saveGarageVehicleForm(formData:FormData):Promise<void>{await saveGarageVehicle(formData);}

export async function removeGarageVehicle(formData:FormData):Promise<{ok:boolean}>{
 const user=await requireUser("/garage");
 const id=text(formData.get("id"));
 if(!id)return {ok:false};
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.from("garage_vehicles").delete().eq("id",id).eq("profile_id",user.id).select("id").maybeSingle();
 if(error||data?.id!==id)return {ok:false};
 revalidatePath("/");
 revalidatePath("/garage");
 revalidatePath("/account");
 return {ok:true};
}
