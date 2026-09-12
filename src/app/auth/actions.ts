"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ActionState,UserRole } from "@/lib/types";
import { safeInternalPath } from "@/lib/navigation";
import { CURRENT_MARKETPLACE_TERMS_VERSION } from "@/lib/policy-versions";

const siteUrl=()=>String(process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000").replace(/\/$/,"");
const emailValue=(formData:FormData)=>String(formData.get("email")??"").trim().toLowerCase();

export async function signIn(_previous:ActionState,formData:FormData):Promise<ActionState>{
 if(!isSupabaseConfigured())return {status:"error",message:"Supabase is not configured."};
 const email=emailValue(formData);
 const password=String(formData.get("password")??"");
 if(!email||!password)return {status:"error",message:"Enter your email and password."};
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.auth.signInWithPassword({email,password});
 if(error)return {status:"error",message:error.message};
 revalidatePath("/","layout");
 redirect(safeInternalPath(formData.get("returnTo"),"/account"));
}

export async function signUp(_previous:ActionState,formData:FormData):Promise<ActionState>{
 if(!isSupabaseConfigured())return {status:"error",message:"Supabase is not configured."};
 const email=emailValue(formData);
 const password=String(formData.get("password")??"");
 const displayName=String(formData.get("displayName")??"").trim();
 const requestedRole=String(formData.get("role")??"buyer");
 const role:UserRole=requestedRole==="seller"?"seller":"buyer";
 const roleDefault=role==="seller"?"/dashboard":"/account";
 const returnTo=safeInternalPath(formData.get("returnTo"),roleDefault);
 const termsAccepted=String(formData.get("termsAccepted")??"")==="1";
 if(displayName.length<2)return {status:"error",message:"Enter your name or business contact name."};
 if(!email.includes("@"))return {status:"error",message:"Enter a valid email address."};
 if(password.length<8)return {status:"error",message:"Use at least 8 characters for your password."};
 if(!termsAccepted)return {status:"error",message:"You need to accept the Terms of Use and Privacy Policy to create an account."};
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.auth.signUp({
  email,password,
  options:{emailRedirectTo:`${siteUrl()}/auth/callback?next=${encodeURIComponent(returnTo)}`,data:{display_name:displayName,role,terms_accepted:"true",terms_version:CURRENT_MARKETPLACE_TERMS_VERSION}}
 });
 if(error)return {status:"error",message:error.message};
 if(data.session){
  revalidatePath("/","layout");
  redirect(returnTo);
 }
 return {status:"success",message:"Check your email to confirm your account. If the message does not arrive, use the resend confirmation link below."};
}

export async function requestPasswordReset(_previous:ActionState,formData:FormData):Promise<ActionState>{
 if(!isSupabaseConfigured())return {status:"error",message:"Authentication is not configured."};
 const email=emailValue(formData);
 if(!email.includes("@"))return {status:"error",message:"Enter a valid email address."};
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${siteUrl()}/auth/callback?next=/auth/reset-password`});
 if(error)return {status:"error",message:"We could not send a reset email right now. Please try again."};
 return {status:"success",message:"If an account exists for that email, a password reset link has been sent."};
}

export async function resendConfirmation(_previous:ActionState,formData:FormData):Promise<ActionState>{
 if(!isSupabaseConfigured())return {status:"error",message:"Authentication is not configured."};
 const email=emailValue(formData);
 if(!email.includes("@"))return {status:"error",message:"Enter a valid email address."};
 const returnTo=safeInternalPath(formData.get("returnTo"),"/account");
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.auth.resend({type:"signup",email,options:{emailRedirectTo:`${siteUrl()}/auth/callback?next=${encodeURIComponent(returnTo)}`}});
 if(error)return {status:"error",message:"We could not resend the confirmation email right now. Please try again shortly."};
 return {status:"success",message:"Confirmation email sent. Check your inbox and spam folder."};
}

export async function updatePassword(_previous:ActionState,formData:FormData):Promise<ActionState>{
 if(!isSupabaseConfigured())return {status:"error",message:"Authentication is not configured."};
 const password=String(formData.get("password")??"");
 const confirmPassword=String(formData.get("confirmPassword")??"");
 if(password.length<8)return {status:"error",message:"Use at least 8 characters for your new password."};
 if(password!==confirmPassword)return {status:"error",message:"The passwords do not match."};
 const supabase=await createSupabaseServerClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return {status:"error",message:"This reset session has expired. Request a new password reset link."};
 const {error}=await supabase.auth.updateUser({password});
 if(error)return {status:"error",message:error.message};
 revalidatePath("/","layout");
 if(String(formData.get("mobileReturn")??"")==="1")redirect("/auth/mobile-complete?state=password-updated");
 redirect("/account/security?password=updated");
}

export async function signOut(){
 if(isSupabaseConfigured()){const supabase=await createSupabaseServerClient();await supabase.auth.signOut();}
 revalidatePath("/","layout");
 redirect("/");
}
