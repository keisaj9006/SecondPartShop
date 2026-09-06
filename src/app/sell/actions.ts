"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function enableSelling(){
 const user=await requireUser("/sell");
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("profiles")
  .update({role:"seller"})
  .eq("id",user.id)
  .eq("role","buyer")
  .select("role")
  .maybeSingle();

 if(error)redirect("/sell?error=upgrade");

 if(!data){
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profile&&(["seller","admin"] as string[]).includes(profile.role))redirect("/dashboard");
  redirect("/sell?error=upgrade");
 }

 revalidatePath("/","layout");
 revalidatePath("/account");
 revalidatePath("/sell");
 redirect("/dashboard?upgraded=1");
}
