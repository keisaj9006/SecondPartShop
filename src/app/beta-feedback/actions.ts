"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const categories=new Set(["navigation","search","compatibility","checkout","seller","notifications","account","performance","other"]);
const severities=new Set(["blocker","major","minor","suggestion"]);
const BETA_PREFIX="[BETA_FEEDBACK v1]";

function value(formData:FormData,key:string){
 return String(formData.get(key)??"").trim();
}

function cleanSingleLine(input:string,max:number){
 return input.replace(/\s+/g," ").trim().slice(0,max);
}

export async function createBetaFeedback(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const user=await requireUser("/beta-feedback");
 const category=value(formData,"category");
 const severity=value(formData,"severity");
 const area=cleanSingleLine(value(formData,"area"),160);
 const summary=cleanSingleLine(value(formData,"summary"),180);
 const steps=value(formData,"steps").slice(0,700);
 const expected=value(formData,"expected").slice(0,320);
 const actual=value(formData,"actual").slice(0,320);

 if(!categories.has(category))return {status:"error",message:"Choose where the problem happened."};
 if(!severities.has(severity))return {status:"error",message:"Choose how serious the issue is."};
 if(summary.length<5)return {status:"error",message:"Add a short summary of the issue."};
 if(steps.length<10)return {status:"error",message:"Please add the steps that reproduce the issue."};
 if(!actual)return {status:"error",message:"Tell us what actually happened."};

 const buildSha=(process.env.VERCEL_GIT_COMMIT_SHA??process.env.GITHUB_SHA??"unknown").slice(0,12);
 const releaseEnvironment=process.env.VERCEL_ENV??process.env.NODE_ENV??"unknown";
 const message=[
  BETA_PREFIX,
  `Category: ${category}`,
  `Severity: ${severity}`,
  `Area/route: ${area||"not provided"}`,
  `Build: ${buildSha}`,
  `Environment: ${releaseEnvironment}`,
  `Summary: ${summary}`,
  "",
  "Steps to reproduce:",
  steps,
  "",
  "Expected:",
  expected||"not provided",
  "",
  "Actual:",
  actual
 ].join("\n");

 if(message.length>2000)return {status:"error",message:"This report is too long. Shorten the reproduction details and try again."};

 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.from("support_requests").insert({profile_id:user.id,topic:"other",message});
 if(error)return {status:"error",message:"We could not submit this beta report right now. Please try again."};

 revalidatePath("/beta-feedback");
 revalidatePath("/admin/moderation");
 revalidatePath("/admin/beta-feedback");
 return {status:"success",message:"Beta report submitted. Thank you — it is now in the SecondPart review queue."};
}
