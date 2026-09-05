import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const safeNext=(candidate:string|null)=>{
 const next=candidate??"/account";
 return next.startsWith("/")&&!next.startsWith("//")?next:"/account";
};

export async function GET(request:Request){
 const url=new URL(request.url);
 const code=url.searchParams.get("code");
 const next=safeNext(url.searchParams.get("next"));
 const providerError=url.searchParams.get("error_description")??url.searchParams.get("error");

 if(providerError){
  const target=next.startsWith("/auth/reset-password")?"/auth/forgot-password?error=expired-link":"/account?error=confirmation-failed";
  return NextResponse.redirect(new URL(target,url.origin));
 }

 if(code){
  const supabase=await createSupabaseServerClient();
  const {error}=await supabase.auth.exchangeCodeForSession(code);
  if(!error)return NextResponse.redirect(new URL(next,url.origin));
 }

 const target=next.startsWith("/auth/reset-password")?"/auth/forgot-password?error=expired-link":"/account?error=confirmation-failed";
 return NextResponse.redirect(new URL(target,url.origin));
}
