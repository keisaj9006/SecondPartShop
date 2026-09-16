import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/navigation";

type SupportedEmailOtpType="email"|"recovery";

const supportedOtpType=(value:string|null):SupportedEmailOtpType|null=>
 value==="email"||value==="recovery"?value:null;

export async function GET(request:Request){
 const url=new URL(request.url);
 const tokenHash=url.searchParams.get("token_hash");
 const type=supportedOtpType(url.searchParams.get("type"));
 const next=safeInternalPath(url.searchParams.get("next"),"/account");
 const confirmationFailure=next==="/account"
  ?"/account?error=confirmation-failed"
  :`/account?error=confirmation-failed&returnTo=${encodeURIComponent(next)}`;

 if(tokenHash&&type){
  const supabase=await createSupabaseServerClient();
  const {error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type});
  if(!error)return NextResponse.redirect(new URL(next,url.origin));
 }

 const target=type==="recovery"||next.startsWith("/auth/reset-password")
  ?"/auth/forgot-password?error=expired-link"
  :confirmationFailure;
 return NextResponse.redirect(new URL(target,url.origin));
}
