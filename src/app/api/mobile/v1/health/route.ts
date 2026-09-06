import { mobileJson,mobileOptions } from "@/lib/mobile-api";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 return mobileJson(request,{
  ok:true,
  service:"secondpart-mobile-api",
  apiVersion:"v1",
  backendReady:isSupabaseConfigured()
 });
}
