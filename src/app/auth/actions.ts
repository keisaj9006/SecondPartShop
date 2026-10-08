"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ActionState,UserRole } from "@/lib/types";
import { safeInternalPath } from "@/lib/navigation";
import { CURRENT_MARKETPLACE_TERMS_VERSION } from "@/lib/policy-versions";
import { resolveAuthEmailOrigin } from "@/lib/auth-email-origin";
import { authErrorMessage,isDuplicateSignupError } from "@/lib/auth-error-messages";

const clearPreviousPushBinding=async()=>{
 if(!/(?:^|;\s*)secondpart_push_device=/.test((await headers()).get("cookie")??""))return true;
 const {detachHostedPushDevice}=await import("@/lib/push/hosted-device");
 return detachHostedPushDevice();
};

const siteUrl=()=>String(process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000").replace(/\/$/,"");
const authReturnOrigin=async()=>resolveAuthEmailOrigin({
 requestOrigin:(await headers()).get("origin"),
 configuredOrigin:siteUrl(),
 vercelEnv:process.env.VERCEL_ENV,
 vercelBranchUrl:process.env.VERCEL_BRANCH_URL,
 vercelUrl:process.env.VERCEL_URL
});
const emailValue=(formData:FormData)=>String(formData.get("email")??"").trim().toLowerCase();

export async function signIn(_previous:ActionState,formData:FormData):Promise<ActionState>{
 if(!isSupabaseConfigured())return {status:"error",message:"Supabase is not configured."};
 const email=emailValue(formData);
 const password=String(formData.get("password")??"");
 if(!email||!password)return {status:"error",message:"Enter your email and password."};
 if(!await clearPreviousPushBinding())return {status:"error",message:"Could not clear notifications on this device. Check your connection and try again."};
 const supabase=await createSupabaseServerClient();
 const response=await supabase.auth.signInWithPassword({email,password}).catch(()=>null);
 if(!response)return {status:"error",message:authErrorMessage({},"signin")};
 const {error}=response;
 if(error)return {status:"error",message:authErrorMessage(error,"signin")};
 revalidatePath("/","layout");
 redirect(safeInternalPath(formData.get("returnTo"),"/account"));
}

export async function signUp(_previous:ActionState,formData:FormData):Promise<ActionState>{
 if(!isSupabaseConfigured())return {status:"error",message:"Supabase is not configured."};
 const email=emailValue(formData);
 const password=String(formData.get("password")??"");
 const confirmPassword=String(formData.get("confirmPassword")??"");
 const displayName=String(formData.get("displayName")??"").trim();
 const requestedRole=String(formData.get("role")??"buyer");
 const role:UserRole=requestedRole==="seller"?"seller":"buyer";
 const roleDefault=role==="seller"?"/dashboard":"/account";
 const returnTo=safeInternalPath(formData.get("returnTo"),roleDefault);
 const termsAccepted=String(formData.get("termsAccepted")??"")==="1";
 if(displayName.length<2)return {status:"error",message:"Enter your name or business contact name."};
 if(!email.includes("@"))return {status:"error",message:"Enter a valid email address."};
 if(password.length<8)return {status:"error",message:"Use at least 8 characters for your password."};
 if(!confirmPassword||password!==confirmPassword)return {status:"error",message:"The passwords do not match. Confirm your password and try again."};
 if(!termsAccepted)return {status:"error",message:"You need to accept the Terms of Use and Privacy Policy to create an account."};
 if(!await clearPreviousPushBinding())return {status:"error",message:"Could not clear notifications on this device. Check your connection and try again."};
 const supabase=await createSupabaseServerClient();
 const returnOrigin=await authReturnOrigin();
 const response=await supabase.auth.signUp({
  email,password,
  options:{emailRedirectTo:`${returnOrigin}/auth/confirm?next=${encodeURIComponent(returnTo)}`,data:{display_name:displayName,role,terms_accepted:"true",terms_version:CURRENT_MARKETPLACE_TERMS_VERSION}}
 }).catch(()=>null);
 if(!response)return {status:"error",message:authErrorMessage({},"signup")};
 const {data,error}=response;
 if(error&&isDuplicateSignupError(error))return {status:"success",message:"Check your email to confirm your account. If the message does not arrive, use the resend confirmation link below."};
 if(error)return {status:"error",message:authErrorMessage(error,"signup")};
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
 const returnOrigin=await authReturnOrigin();
 const response=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${returnOrigin}/auth/confirm?next=${encodeURIComponent("/auth/reset-password")}`}).catch(()=>null);
 if(!response)return {status:"error",message:authErrorMessage({},"password-reset")};
 const {error}=response;
 if(error)return {status:"error",message:authErrorMessage(error,"password-reset")};
 return {status:"success",message:"If an account exists for that email, you can use a password-reset email if it arrives. Check your inbox and spam folder."};
}

export async function resendConfirmation(_previous:ActionState,formData:FormData):Promise<ActionState>{
 if(!isSupabaseConfigured())return {status:"error",message:"Authentication is not configured."};
 const email=emailValue(formData);
 if(!email.includes("@"))return {status:"error",message:"Enter a valid email address."};
 const returnTo=safeInternalPath(formData.get("returnTo"),"/account");
 const supabase=await createSupabaseServerClient();
 const returnOrigin=await authReturnOrigin();
 const response=await supabase.auth.resend({type:"signup",email,options:{emailRedirectTo:`${returnOrigin}/auth/confirm?next=${encodeURIComponent(returnTo)}`}}).catch(()=>null);
 if(!response)return {status:"error",message:authErrorMessage({},"resend-confirmation")};
 const {error}=response;
 if(error)return {status:"error",message:authErrorMessage(error,"resend-confirmation")};
 return {status:"success",message:"If this address is eligible for confirmation, a confirmation email request was accepted. Check your inbox and spam folder."};
}

export async function updatePassword(_previous:ActionState,formData:FormData):Promise<ActionState>{
 if(!isSupabaseConfigured())return {status:"error",message:"Authentication is not configured."};
 const password=String(formData.get("password")??"");
 const confirmPassword=String(formData.get("confirmPassword")??"");
 if(password.length<8)return {status:"error",message:"Use at least 8 characters for your new password."};
 if(password!==confirmPassword)return {status:"error",message:"The passwords do not match."};
 const supabase=await createSupabaseServerClient();
 const session=await supabase.auth.getUser().catch(()=>null);
 if(!session)return {status:"error",message:authErrorMessage({},"update-password")};
 const {data:{user}}=session;
 if(!user)return {status:"error",message:"This reset session has expired. Request a new password reset link."};
 const response=await supabase.auth.updateUser({password}).catch(()=>null);
 if(!response)return {status:"error",message:authErrorMessage({},"update-password")};
 const {error}=response;
 if(error)return {status:"error",message:authErrorMessage(error,"update-password")};
 revalidatePath("/","layout");
 if(String(formData.get("mobileReturn")??"")==="1")redirect("/auth/mobile-complete?state=password-updated");
 redirect("/account/security?password=updated");
}

export async function signOut(){
 if(isSupabaseConfigured()){
  const {detachHostedPushDevice}=await import("@/lib/push/hosted-device");
  if(!await detachHostedPushDevice())redirect("/account?error=push-detach-failed");
  const supabase=await createSupabaseServerClient();await supabase.auth.signOut();
 }
 revalidatePath("/","layout");
 redirect("/");
}
