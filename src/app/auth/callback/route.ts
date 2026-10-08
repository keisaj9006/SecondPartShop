import {NextResponse} from "next/server";
import {finishAuthReturn} from "@/lib/auth-return";
export async function GET(request:Request){
 const url=new URL(request.url);
 if(/(?:^|;\s*)secondpart_native=1(?:;|$)/.test(request.headers.get("cookie")??"")){
  // Exchange only after the native continuation has acquired the account-change lock.
  return NextResponse.redirect(new URL("/auth/native-return/callback"+url.search,url.origin));
 }
 return finishAuthReturn(request,"callback");
}
