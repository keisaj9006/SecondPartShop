import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {safeInternalPath} from "@/lib/navigation";

type SupportedEmailOtpType="email"|"recovery";
const supportedOtpType=(value:string|null):SupportedEmailOtpType|null=>value==="email"||value==="recovery"?value:null;
const sensitiveReturnKey=/^(access_token|refresh_token|token|token_hash|code|otp|password|error|error_description|error_code|error_uri)$/i;
function safeAuthReturnTo(value:string|null){
 const safe=safeInternalPath(value,"/account");
 const target=new URL(safe,"https://secondpart.invalid");
 for(const key of [...target.searchParams.keys()])if(sensitiveReturnKey.test(key))target.searchParams.delete(key);
 const fragment=target.hash.slice(1);
 const safeHash=/(?:^|[?&])(access_token|refresh_token|token|token_hash|code|otp|password|error|error_description|error_code|error_uri)=/i.test(fragment)?"":target.hash;
 return `${target.pathname}${target.search}${safeHash}`;
}
const confirmationStatus=(state:"confirmed"|"invalid"|"already-confirmed",returnTo:string)=>`/auth/confirmation-status?state=${state}&returnTo=${encodeURIComponent(returnTo)}`;
async function currentSessionConfirmed(supabase:{auth:{getUser:()=>Promise<{data:{user:{email_confirmed_at?:string|null}|null};error:unknown}>}}){
 try{const {data,error}=await supabase.auth.getUser();return !error&&Boolean(data.user?.email_confirmed_at);}catch{return false;}
}
// Both the original web routes and the locked native action use this provider-authoritative flow.
export async function finishAuthReturn(request:Request,flow:"callback"|"confirm"){
 const url=new URL(request.url);
 const next=safeAuthReturnTo(url.searchParams.get("next"));
 const tokenHash=flow==="confirm"?url.searchParams.get("token_hash"):null;
 const type=flow==="confirm"?supportedOtpType(url.searchParams.get("type")):null;
 const recovery=(flow==="confirm"&&type==="recovery")||next.startsWith("/auth/reset-password");
 const recoveryTarget=next.startsWith("/auth/reset-password")?next:"/auth/reset-password";
 const supabase=await createSupabaseServerClient();
 const providerFailed=flow==="confirm"?url.searchParams.has("error")||url.searchParams.has("error_description"):Boolean(url.searchParams.get("error_description")??url.searchParams.get("error"));
 if(!providerFailed&&tokenHash&&type){
  try{const {error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type});if(!error)return NextResponse.redirect(new URL(recovery?recoveryTarget:confirmationStatus("confirmed",next),url.origin));}catch{}
 }
 const code=url.searchParams.get("code");
 if(!providerFailed&&(flow==="callback"||!url.searchParams.has("token_hash"))&&code){
  try{const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(recovery?recoveryTarget:confirmationStatus("confirmed",next),url.origin));}catch{}
 }
 if(recovery)return NextResponse.redirect(new URL("/auth/forgot-password?error=expired-link",url.origin));
 const state=await currentSessionConfirmed(supabase)?"already-confirmed":"invalid";
 return NextResponse.redirect(new URL(confirmationStatus(state,next),url.origin));
}
